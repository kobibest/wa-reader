// Local bridge between this MCP server and the WA Reader Chrome extension.
//
// The first wa-reader-mcp process binds 127.0.0.1:<port> and is the "primary":
//   - the extension connects to it over WebSocket (path /ext) and answers requests
//   - other wa-reader-mcp processes (e.g. Claude Desktop + Cursor both running one) forward
//     their requests to the primary over HTTP POST /rpc
// If the primary goes away, the next request from a secondary tries to become primary.
//
// Security (anything on this computer, including web pages in your browser, can try to reach 127.0.0.1):
//   - binds to 127.0.0.1 only
//   - WebSocket: Origin must be a chrome-extension:// origin, and the extension must send the shared token
//   - /rpc: rejects any request that carries an Origin header (i.e. any browser), and requires the token
//   - tokens are compared in constant time
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX_BODY = 1_000_000;

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

export class Bridge {
  constructor({ port, token, log = () => {} }) {
    this.port = port;
    this.token = token;
    this.log = log;
    this.role = 'none'; // 'primary' | 'secondary'
    this.ext = null;    // active extension socket (primary only)
    this.extInfo = null;
    this.pending = new Map();
    this.seq = 0;
    this.server = null;
  }

  async start() {
    try {
      await this.#listen();
      this.role = 'primary';
      this.log(`bridge: primary on 127.0.0.1:${this.port}`);
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      this.role = 'secondary';
      this.log(`bridge: port ${this.port} busy, acting as secondary`);
    }
  }

  #listen() {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.#onHttp(req, res));
      const wss = new WebSocketServer({ noServer: true, maxPayload: 50 * 1024 * 1024 });
      server.on('upgrade', (req, socket, head) => {
        const origin = req.headers.origin || '';
        if (req.url !== '/ext' || !origin.startsWith('chrome-extension://')) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => this.#onExtSocket(ws, origin));
      });
      server.once('error', reject);
      server.listen(this.port, '127.0.0.1', () => {
        server.off('error', reject);
        server.on('error', (err) => this.log('bridge http error: ' + err.message));
        this.server = server;
        resolve();
      });
    });
  }

  #onExtSocket(ws, origin) {
    let authed = false;
    const authTimer = setTimeout(() => { if (!authed) ws.close(4001, 'auth timeout'); }, 5000);
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!authed) {
        if (msg.type === 'hello' && safeEqual(msg.token, this.token)) {
          authed = true; clearTimeout(authTimer);
          if (this.ext && this.ext !== ws) { try { this.ext.close(4002, 'replaced'); } catch {} }
          this.ext = ws;
          this.extInfo = { origin, version: msg.version || '', connectedAt: Date.now() };
          ws.send(JSON.stringify({ type: 'welcome' }));
          this.log('bridge: extension connected ' + origin);
        } else {
          ws.close(4003, 'bad token');
        }
        return;
      }
      if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      if (msg.type === 'response') {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); clearTimeout(p.timer); msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error || 'extension error')); }
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (this.ext === ws) { this.ext = null; this.extInfo = null; this.log('bridge: extension disconnected'); }
    });
    ws.on('error', () => {});
  }

  #onHttp(req, res) {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.headers.origin) return send(403, { error: 'forbidden' });           // browsers always send Origin on POST
    if (req.method !== 'POST' || req.url !== '/rpc') return send(404, { error: 'not found' });
    if (!safeEqual(req.headers['x-wa-reader-token'], this.token)) return send(401, { error: 'unauthorized' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', async () => {
      let msg;
      try { msg = JSON.parse(body); } catch { return send(400, { error: 'bad json' }); }
      try { send(200, { ok: true, result: await this.#callExtension(msg.method, msg.params, msg.timeoutMs) }); }
      catch (e) { send(200, { ok: false, error: e.message }); }
    });
  }

  #callExtension(method, params, timeoutMs = 60000) {
    if (method === '__bridge_status') return Promise.resolve({ extensionConnected: !!this.ext, ext: this.extInfo });
    if (!this.ext) return Promise.reject(new Error(EXT_OFFLINE));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The WA Reader extension did not answer in time. Is the WhatsApp Web tab still open?')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ext.send(JSON.stringify({ type: 'request', id, method, params: params || {} }));
    });
  }

  async call(method, params, timeoutMs) {
    if (this.role === 'primary') return this.#callExtension(method, params, timeoutMs);
    // secondary: forward to primary; if it is gone, try to take over
    try {
      return await this.#forward(method, params, timeoutMs);
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        await this.start();
        if (this.role === 'primary') return this.#callExtension(method, params, timeoutMs);
      }
      throw e;
    }
  }

  #forward(method, params, timeoutMs = 60000) {
    const body = JSON.stringify({ method, params, timeoutMs });
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: this.port, path: '/rpc', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-wa-reader-token': this.token },
        timeout: timeoutMs + 5000 }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 401) return reject(new Error('Another wa-reader-mcp is running on this port with a different WA_READER_TOKEN. Use the same token in every AI tool, or set a different WA_READER_PORT.'));
          try { const j = JSON.parse(data); j.ok ? resolve(j.result) : reject(new Error(j.error)); } catch { reject(new Error('bad response from primary bridge')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('bridge timeout')));
      req.end(body);
    });
  }

  close() { try { this.server?.close(); } catch {} }
}

export const EXT_OFFLINE =
  'WhatsApp is not connected. Ask the user to: (1) open https://web.whatsapp.com in Chrome, ' +
  '(2) make sure the WA Reader extension is installed and activated, and ' +
  '(3) check that the token in the extension settings matches WA_READER_TOKEN in this MCP server config.';
