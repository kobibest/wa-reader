// When WhatsApp Web changes its internals, page.js must report 'wa_changed' instead of failing silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pageSrc = fs.readFileSync('extension/page/page.js', 'utf8');

function runPage(WPP) {
  const posted = [];
  const ctx = { location: { origin: 'https://web.whatsapp.com' }, console, WPP };
  ctx.window = ctx;
  ctx.postMessage = (data) => posted.push(data);
  ctx.addEventListener = () => {};
  vm.runInNewContext(pageSrc, ctx);
  return posted;
}

const fullApi = () => ({
  version: 'test',
  isFullReady: true,
  loader: { onFullReady: (f) => f() },
  chat: { list: async () => [], get: async () => null, getMessages: async () => [] },
  contact: { get: async () => null },
  conn: { getMyUserId: () => ({ _serialized: '972500000000@c.us' }) }
});

test('healthy WA-JS reports ready', () => {
  const posted = runPage(fullApi());
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'ready');
});

test('a renamed WA-JS API reports wa_changed with the missing names', () => {
  const W = fullApi();
  delete W.chat.list; // WhatsApp Web renamed the internals WA-JS used
  const posted = runPage(W);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'error');
  assert.equal(posted[0].payload.code, 'wa_changed');
  assert.deepEqual([...posted[0].payload.missing], ['chat.list']); // spread: arrays from the vm realm
});

test('WA-JS that never loaded reports wa_changed', () => {
  const posted = runPage(undefined);
  assert.equal(posted[0].type, 'error');
  assert.equal(posted[0].payload.code, 'wa_changed');
});

test('a throwing loader reports wa_changed instead of failing silently', () => {
  const W = fullApi();
  W.isFullReady = false;
  W.loader.onFullReady = () => { throw new Error('boom'); };
  const posted = runPage(W);
  assert.equal(posted[0].payload.code, 'wa_changed');
  assert.match(posted[0].payload.error, /boom/);
});
