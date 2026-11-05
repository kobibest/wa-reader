// Bridge security and protocol tests: node --test test/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { Bridge, NOT_CONNECTED } from '../mcp/bridge.js';
import { allowedOrigins, STORE_EXTENSION_ID } from '../mcp/config.js';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const GOOD = `chrome-extension://${ID}`;
let port = 27345;

const bridges = [];
after(() => bridges.forEach((b) => b.close()));

async function makeBridge(timeoutMs = 500) {
  const b = new Bridge({ host: '127.0.0.1', port: ++port, origins: new Set([GOOD]), timeoutMs });
  bridges.push(b);
  b.start();
  await new Promise((r) => b.server.once('listening', r));
  return b;
}

function connect(p, origin) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p}`, origin === undefined ? {} : { origin });
    ws.on('open', () => resolve({ ok: true, ws }));
    ws.on('unexpected-response', (_req, res) => resolve({ ok: false, status: res.statusCode }));
    ws.on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

test('listens on 127.0.0.1 only', async () => {
  const b = await makeBridge();
  assert.equal(b.server.address().address, '127.0.0.1');
  b.close();
});

test('refuses every origin that is not exactly the extension', async () => {
  const b = await makeBridge();
  for (const origin of [undefined, 'null', 'https://example.com', 'http://127.0.0.1:8080', 'https://web.whatsapp.com',
    'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', `${GOOD}/`, `${GOOD}.evil.com`, GOOD.toUpperCase(), `moz-extension://${ID}`]) {
    const r = await connect(b.port, origin);
    assert.equal(r.ok, false, `origin ${origin} must be refused`);
    assert.equal(r.status, 403, `origin ${origin} → 403`);
  }
  assert.equal(b.connected, false);
  b.close();
});

test('accepts the exact extension origin and runs the protocol', async () => {
  const b = await makeBridge();
  const { ok, ws } = await connect(b.port, GOOD);
  assert.ok(ok);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'listChats') ws.send(JSON.stringify({ id: m.id, result: { chats: [{ id: 'x@c.us' }], echo: m.params } }));
    if (m.method === 'getMessages') ws.send(JSON.stringify({ id: m.id, error: 'nope' }));
  });
  await new Promise((r) => setTimeout(r, 50));
  const res = await b.call('listChats', { limit: 3 });
  assert.deepEqual(res, { chats: [{ id: 'x@c.us' }], echo: { limit: 3 } });
  await assert.rejects(b.call('getMessages', {}), /nope/);
  await assert.rejects(b.call('search', {}), /15 שניות/); // no answer → timeout
  ws.close(); b.close();
});

test('ping gets a pong', async () => {
  const b = await makeBridge();
  const { ws } = await connect(b.port, GOOD);
  const pong = new Promise((r) => ws.once('message', (raw) => r(JSON.parse(raw))));
  ws.send('{"type":"ping"}');
  assert.deepEqual(await pong, { type: 'pong' });
  ws.close(); b.close();
});

test('a new connection replaces the previous one', async () => {
  const b = await makeBridge();
  const a = (await connect(b.port, GOOD)).ws;
  const closed = new Promise((r) => a.once('close', (code) => r(code)));
  const c = (await connect(b.port, GOOD)).ws;
  assert.equal(await closed, 4000);
  c.on('message', (raw) => { const m = JSON.parse(raw); c.send(JSON.stringify({ id: m.id, result: 'from-new' })); });
  assert.equal(await b.call('status'), 'from-new');
  c.close(); b.close();
});

test('clear Hebrew error when the extension is not connected', async () => {
  const b = await makeBridge();
  await assert.rejects(b.call('status'), (e) => e.message === NOT_CONNECTED && /פתח את WhatsApp Web בכרום ובדוק שהתוסף פעיל/.test(e.message));
  b.close();
});

test('allowed origins come from config, exact ids only', () => {
  assert.deepEqual([...allowedOrigins({})], [`chrome-extension://${STORE_EXTENSION_ID}`]);
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: `${ID}, bad, ${ID.toUpperCase()}` })], [GOOD]);
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: '' })], [`chrome-extension://${STORE_EXTENSION_ID}`]);
});
