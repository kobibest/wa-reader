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
  assert.equal(m.version, '2.0.0');
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
