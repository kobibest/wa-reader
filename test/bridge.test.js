// Bridge security and protocol tests: node --test test/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { Bridge, NOT_CONNECTED } from '../mcp/bridge.js';
import { allowedOrigins, STORE_EXTENSION_ID, DEV_EXTENSION_ID } from '../mcp/config.js';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const GOOD = `chrome-extension://${ID}`;
let port = 27345;

const bridges = [];
after(() => bridges.forEach((b) => b.close()));

async function makeBridge(timeoutMs = 500, p = ++port) {
  const b = new Bridge({ host: '127.0.0.1', port: p, origins: new Set([GOOD]), timeoutMs, retryMs: 200 });
  bridges.push(b);
  await b.start();
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
  const defaults = [`chrome-extension://${STORE_EXTENSION_ID}`, `chrome-extension://${DEV_EXTENSION_ID}`];
  assert.deepEqual([...allowedOrigins({})], defaults);
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: `${ID}, bad, ${ID.toUpperCase()}` })], [GOOD]);
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: '' })], defaults);
  // invisible direction marks / spaces copied from Chrome's Hebrew UI are ignored
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: `\u200f\u200e ${ID}\u200e ` })], [GOOD]);
  assert.deepEqual([...allowedOrigins({ WA_READER_EXTENSION_ID: `מזהה: ${ID}` })], [GOOD]);
});

test('a second WA Reader process forwards to the one holding the port, and takes over when it exits', async () => {
  const first = await makeBridge(2000);
  const second = await makeBridge(2000, first.port);
  assert.equal(first.role, 'primary');
  assert.equal(second.role, 'secondary');
  await assert.rejects(second.call('status'), (e) => e.message === NOT_CONNECTED);

  const ext = (await connect(first.port, GOOD)).ws;
  ext.on('message', (raw) => { const m = JSON.parse(raw); if (m.method) ext.send(JSON.stringify({ id: m.id, result: { via: m.method, p: m.params } })); });
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(await second.call('listChats', { limit: 2 }), { via: 'listChats', p: { limit: 2 } });
  assert.deepEqual(await first.call('status'), { via: 'status', p: {} });

  // errors from the extension pass through
  ext.removeAllListeners('message');
  ext.on('message', (raw) => { const m = JSON.parse(raw); if (m.method) ext.send(JSON.stringify({ id: m.id, error: 'boom' })); });
  await assert.rejects(second.call('search', {}), /boom/);

  // the primary exits → the secondary takes the port and the extension can reconnect to it
  first.close(); ext.close();
  for (let i = 0; i < 30 && second.role !== 'primary'; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(second.role, 'primary');
  const ext2 = (await connect(second.port, GOOD)).ws;
  ext2.on('message', (raw) => { const m = JSON.parse(raw); if (m.method) ext2.send(JSON.stringify({ id: m.id, result: 'now-direct' })); });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(await second.call('status'), 'now-direct');
  // and still refuses web pages
  assert.equal((await connect(second.port, 'https://example.com')).status, 403);
  ext2.close();
});

test('a refused extension ID is explained in the "not connected" error', async () => {
  const b = await makeBridge();
  const r = await connect(b.port, 'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(r.status, 403);
  await assert.rejects(b.call('status'), (e) => e.message.includes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') && e.message.includes(ID) && e.message.includes('wa-reader-test'));
});

test('a call can ask for a longer timeout (file download), also through a second process', async () => {
  const first = await makeBridge(100);
  const second = await makeBridge(100, first.port);
  const ext = (await connect(first.port, GOOD)).ws;
  ext.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'getMedia') setTimeout(() => ext.send(JSON.stringify({ id: m.id, result: { base64: 'x'.repeat(m.params.n) } })), 400);
  });
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(first.call('getMedia', { n: 1 }), /15 שניות/);            // default limit (100 ms here)
  assert.equal((await first.call('getMedia', { n: 3 }, 2000)).base64, 'xxx');
  // a large answer (5 MB) forwarded over the local IPC channel
  assert.equal((await second.call('getMedia', { n: 5 * 1024 * 1024 }, 5000)).base64.length, 5 * 1024 * 1024);
  await assert.rejects(second.call('getMedia', { n: 1 }, 200), /0 שניות|1 שניות|not connected|לא ענה/);
  ext.close(); first.close(); second.close();
});
