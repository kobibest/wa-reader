// Local WebSocket bridge between this MCP server and the WA Reader Chrome extension.
//
// Security – anything on this computer, including any web page open in a browser, can try to reach 127.0.0.1:
//   - listens on 127.0.0.1 only (never 0.0.0.0)
//   - accepts a connection only when the Origin header is exactly chrome-extension://<allowed id>;
//     everything else (web pages, other extensions, scripts without an Origin) is refused with 403
//   - one active connection at a time: a new accepted connection replaces the previous one
//   - nothing is written to disk; requests and answers live in memory until the call returns
//
// Protocol (JSON text frames):
//   server → extension  {id, method, params}
//   extension → server  {id, result} | {id, error}
//   extension → server  {type: "ping"} every 20 s (keeps Chrome's service worker alive) → {type: "pong"}
//
// More than one WA Reader process (Claude Desktop sometimes starts an extension's server twice):
//   the process that holds the port is the "primary". Other processes ("secondary") forward their calls to it
//   over a local IPC channel – a named pipe on Windows, a Unix socket (mode 0600) in the per-user temp dir on
//   macOS/Linux. It is not TCP, so browsers cannot reach it, and the Origin rule on the port is unchanged.
//   A secondary keeps trying to take the port, and becomes primary when the old process exits.
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

export const NOT_CONNECTED =
  'התוסף WA Reader לא מחובר. פתח את WhatsApp Web בכרום ובדוק שהתוסף פעיל.';
const TIMEOUT = 'התוסף לא ענה תוך 15 שניות. בדוק שהטאב של WhatsApp Web פתוח וטעון, ונסה שוב.';
const MAX_LINE = 32 * 1024 * 1024;

export function ipcPath(port) {
  let user = 'user';
  try { user = os.userInfo().username || user; } catch { /* ignore */ }
  user = user.replace(/[^\w.-]/g, '_').slice(0, 40);
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\wa-reader-${user}-${port}`
    : path.join(os.tmpdir(), `wa-reader-${user}-${port}.sock`);
}

export class Bridge {
  constructor({ host, port, origins, timeoutMs, retryMs = 3000, ipc = ipcPath(port), log = () => {} }) {
    Object.assign(this, { host, port, origins, timeoutMs, retryMs, ipc, log });
    this.role = 'starting'; // 'primary' | 'secondary'
    this.ext = null;
    this.pending = new Map();
    this.seq = 0;
    this.server = null;
    this.ipcServer = null;
    this.retry = null;
    this.closed = false;
    this.lastRefused = null; // { origin, at } – shown in the "not connected" error to help fix a wrong Extension ID
  }

  get connected() { return !!this.ext && this.ext.readyState === 1; }

  // Resolves once this process is primary or secondary.
  start() {
    return new Promise((resolve) => {
      const server = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
      const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 });
      server.on('upgrade', (req, socket, head) => {
        const origin = req.headers.origin;
        if (typeof origin !== 'string' || !this.origins.has(origin)) {
          this.log(`refused connection from origin ${JSON.stringify(origin ?? null)}`);
          if (typeof origin === 'string' && origin.startsWith('chrome-extension://')) this.lastRefused = { origin, at: Date.now() };
          socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => this.#accept(ws, origin));
      });
      server.on('error', (err) => {
        if (err.code !== 'EADDRINUSE') { this.log('bridge error: ' + err.message); return; }
        if (this.role !== 'secondary') this.log(`port ${this.port} is held by another WA Reader process – forwarding to it`);
        this.role = 'secondary';
        resolve();
        clearTimeout(this.retry);
        if (!this.closed) this.retry = setTimeout(() => server.listen(this.port, this.host), this.retryMs);
      });
      server.on('listening', () => {
        this.role = 'primary';
        this.log(`listening on ${this.host}:${this.port}`);
        this.#startIpc().finally(resolve);
      });
      this.server = server;
      server.listen(this.port, this.host);
    });
  }

  // ---------- primary: extension socket ----------
  #accept(ws, origin) {
    const prev = this.ext;
    this.ext = ws;
    if (prev) {
      this.#failPending('החיבור לתוסף הוחלף בחיבור חדש. נסה שוב.');
      try { prev.close(4000, 'replaced'); } catch { /* ignore */ }
    }
    this.log(`extension connected (${origin})`);
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ping') { try { ws.send('{"type":"pong"}'); } catch { /* ignore */ } return; }
      const p = this.pending.get(msg.id);
      if (!p || p.ws !== ws) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if ('error' in msg) p.reject(new Error(String(msg.error?.message || msg.error || 'שגיאה בתוסף')));
      else p.resolve(msg.result);
    });
    ws.on('close', () => {
      if (this.ext !== ws) return;
      this.ext = null;
      this.#failPending(NOT_CONNECTED);
      this.log('extension disconnected');
    });
    ws.on('error', () => { /* close follows */ });
  }

  #failPending(message) {
    for (const [id, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(message)); this.pending.delete(id); }
  }

  // "not connected" + what we know about why (no message content, only extension IDs)
  notConnectedMessage() {
    const r = this.lastRefused;
    if (!r || Date.now() - r.at > 10 * 60000) return NOT_CONNECTED;
    const got = r.origin.replace('chrome-extension://', '');
    const allowed = [...this.origins].map((o) => o.replace('chrome-extension://', '')).join(', ');
    return `התוסף WA Reader ניסה להתחבר אבל נדחה, כי המזהה שלו לא תואם להגדרות. ` +
      `מזהה התוסף בכרום: ${got}. המזהה שמוגדר בהרחבה ב-Claude Desktop: ${allowed}. ` +
      `תקן את Extension ID בהגדרות ההרחבה WA Reader ב-Claude Desktop (Settings ← Desktop app ← Extensions), שמור, וכבה והדלק את ההרחבה.`;
  }

  #callExtension(method, params = {}) {
    if (!this.connected) return Promise.reject(new Error(this.notConnectedMessage()));
    const ws = this.ext;
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(TIMEOUT)); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, ws });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error(NOT_CONNECTED)); }
    });
  }

  // ---------- primary: local IPC for other WA Reader processes ----------
  #startIpc() {
    return new Promise((resolve) => {
      // only the primary creates this socket, and we hold the port – any existing file is stale
      if (process.platform !== 'win32') { try { fs.unlinkSync(this.ipc); } catch { /* none */ } }
      const srv = net.createServer((sock) => {
        let buf = '';
        sock.setEncoding('utf8');
        sock.on('data', (chunk) => {
          buf += chunk;
          if (buf.length > MAX_LINE) { sock.destroy(); return; }
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            let msg;
            try { msg = JSON.parse(line); } catch { continue; }
            const reply = (o) => { try { sock.write(JSON.stringify({ id: msg.id, ...o }) + '\n'); } catch { /* ignore */ } };
            this.#callExtension(String(msg.method || ''), msg.params || {})
              .then((result) => reply({ result }), (e) => reply({ error: e.message }));
          }
        });
        sock.on('error', () => {});
      });
      srv.on('error', (e) => { this.log('ipc error: ' + e.message); resolve(); });
      srv.listen(this.ipc, () => {
        if (process.platform !== 'win32') { try { fs.chmodSync(this.ipc, 0o600); } catch { /* ignore */ } }
        this.ipcServer = srv;
        resolve();
      });
    });
  }

  // ---------- secondary: forward to the primary ----------
  #forward(method, params) {
    return new Promise((resolve, reject) => {
      const sock = net.connect(this.ipc);
      let buf = '', done = false;
      const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); sock.destroy(); fn(v); };
      const timer = setTimeout(() => finish(reject, new Error(TIMEOUT)), this.timeoutMs + 2000);
      sock.setEncoding('utf8');
      sock.on('connect', () => sock.write(JSON.stringify({ id: 1, method, params }) + '\n'));
      sock.on('data', (chunk) => {
        buf += chunk;
        if (buf.length > MAX_LINE) return finish(reject, new Error('answer too large'));
        const nl = buf.indexOf('\n');
        if (nl < 0) return;
        let msg;
        try { msg = JSON.parse(buf.slice(0, nl)); } catch { return finish(reject, new Error('bad answer from WA Reader')); }
        if ('error' in msg) finish(reject, new Error(String(msg.error)));
        else finish(resolve, msg.result);
      });
      sock.on('error', () => finish(reject, new Error(NOT_CONNECTED)));
      sock.on('close', () => finish(reject, new Error(NOT_CONNECTED)));
    });
  }

  call(method, params = {}) {
    if (this.role === 'secondary') return this.#forward(method, params);
    return this.#callExtension(method, params);
  }

  close() {
    this.closed = true;
    clearTimeout(this.retry);
    try { this.ext?.close(1001, 'server shutdown'); } catch { /* ignore */ }
    try { this.server?.close(); } catch { /* ignore */ }
    if (this.ipcServer) {
      try { this.ipcServer.close(); } catch { /* ignore */ }
      if (process.platform !== 'win32') { try { fs.unlinkSync(this.ipc); } catch { /* ignore */ } }
    }
  }
}
