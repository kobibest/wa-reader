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
import http from 'node:http';
import { WebSocketServer } from 'ws';

export const NOT_CONNECTED =
  'התוסף WA Reader לא מחובר. פתח את WhatsApp Web בכרום ובדוק שהתוסף פעיל.';

export class Bridge {
  constructor({ host, port, origins, timeoutMs, log = () => {} }) {
    Object.assign(this, { host, port, origins, timeoutMs, log });
    this.ext = null;
    this.pending = new Map();
    this.seq = 0;
    this.server = null;
    this.retry = null;
    this.closed = false;
  }

  get connected() { return !!this.ext && this.ext.readyState === 1; }

  start() {
    const server = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 });
    server.on('upgrade', (req, socket, head) => {
      const origin = req.headers.origin;
      if (typeof origin !== 'string' || !this.origins.has(origin)) {
        this.log(`refused connection from origin ${JSON.stringify(origin ?? null)}`);
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.#accept(ws, origin));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.log(`port ${this.port} is busy, retrying in 5 s`);
        clearTimeout(this.retry);
        if (!this.closed) this.retry = setTimeout(() => server.listen(this.port, this.host), 5000);
      } else this.log('bridge error: ' + err.message);
    });
    server.listen(this.port, this.host, () => this.log(`listening on ${this.host}:${this.port}`));
    this.server = server;
  }

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

  call(method, params = {}) {
    if (!this.connected) return Promise.reject(new Error(NOT_CONNECTED));
    const ws = this.ext;
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('התוסף לא ענה תוך 15 שניות. בדוק שהטאב של WhatsApp Web פתוח וטעון, ונסה שוב.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, ws });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error(NOT_CONNECTED)); }
    });
  }

  close() {
    this.closed = true;
    clearTimeout(this.retry);
    try { this.ext?.close(1001, 'server shutdown'); } catch { /* ignore */ }
    try { this.server?.close(); } catch { /* ignore */ }
  }
}
