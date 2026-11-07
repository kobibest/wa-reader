// Guards against regressions that would let data leave the computer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('WA-JS external features are off', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('extension/page/config.js', 'utf8'), ctx);
  const c = ctx.window.WPPConfig;
  assert.equal(c.disableGoogleAnalytics, true);
  assert.equal(c.googleAnalyticsId, null);
  // must be an EMPTY ARRAY – null/undefined makes WA-JS fall back to third-party link-preview servers
  assert.ok(Array.isArray(c.linkPreviewApiServers) && c.linkPreviewApiServers.length === 0);
});

test('extension can only connect to the local bridge', () => {
  const m = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  assert.deepEqual(m.host_permissions, ['https://web.whatsapp.com/*']);
  assert.ok(!m.content_scripts, 'no static content scripts on other sites');
  assert.match(m.content_security_policy.extension_pages, /connect-src ws:\/\/127\.0\.0\.1:17345;/);
  assert.equal(m.version, JSON.parse(fs.readFileSync('package.json', 'utf8')).version, 'extension and mcpb versions match');
});

test('no network APIs in our own code', () => {
  const files = ['mcp/server.js', 'mcp/bridge.js', 'mcp/tools.js', 'mcp/config.js', 'extension/background.js',
    'extension/bridge.js', 'extension/page/page.js', 'extension/page/config.js',
    ...fs.readdirSync('extension/ui').filter((f) => f.endsWith('.js')).map((f) => 'extension/ui/' + f)];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|EventSource|importScripts|chrome\.storage\.(local|sync|session)\.set\(\{\s*(messages|chats|cache)/, f);
  }
});

test('the test build ID is fixed by "key" and accepted by default', async () => {
  const crypto = await import('node:crypto');
  const { DEV_EXTENSION_ID, allowedOrigins } = await import('../mcp/config.js');
  const m = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  const h = crypto.createHash('sha256').update(Buffer.from(m.key, 'base64')).digest('hex').slice(0, 32);
  const id = [...h].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  assert.equal(id, DEV_EXTENSION_ID);
  assert.ok(allowedOrigins({}).has(`chrome-extension://${id}`));
  const mcpb = JSON.parse(fs.readFileSync('mcpb/manifest.json', 'utf8'));
  assert.ok(!mcpb.user_config, 'no settings for the user to get wrong');
});
