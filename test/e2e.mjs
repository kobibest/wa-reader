// End-to-end check: MCP client → packed .mcpb server (stdio) → WebSocket 127.0.0.1:17345 → real Chrome extension
// (unpacked, dev ID) → content scripts → a stand-in WhatsApp Web page with a fake WPP data layer.
// Also checks that a normal web page cannot open the WebSocket.
//
//   ./scripts/build-mcpb.sh && ./scripts/package.sh && node test/e2e.mjs
// Needs Playwright's Chromium (require('playwright')). Not part of `npm test`.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DEV_EXTENSION_ID } from '../mcp/config.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-e2e-'));

// 1. unpack the built .mcpb exactly as Claude Desktop would get it
const unpacked = path.join(tmp, 'mcpb');
execFileSync('unzip', ['-q', path.join(root, 'dist/wa-reader.mcpb'), '-d', unpacked]);
const manifest = JSON.parse(fs.readFileSync(path.join(unpacked, 'manifest.json'), 'utf8'));
const args = manifest.server.mcp_config.args.map((a) => a.replace('${__dirname}', unpacked));

// Claude Desktop sometimes starts an extension's server twice. Reproduce that: a first process takes the port,
// and the MCP client below talks to a second one, which must forward to the first.
const { spawn } = await import('node:child_process');
const firstLog = [];
const first = spawn(process.execPath, args, { env: (({ WA_READER_EXTENSION_ID, ...e }) => e)(process.env), stdio: ['pipe', 'ignore', 'pipe'] });
first.stderr.on('data', (d) => firstLog.push(String(d)));
await new Promise((r) => setTimeout(r, 1500));

const serverLog = [];
const transport = new StdioClientTransport({
  command: process.execPath, args,
  env: (({ WA_READER_EXTENSION_ID, ...e }) => e)(process.env),
  stderr: 'pipe'
});
transport.stderr.on('data', (d) => serverLog.push(String(d)));
const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(transport);
const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, ['get_messages', 'list_chats', 'search', 'whatsapp_status']);
const call = async (name, a = {}) => {
  const r = await client.callTool({ name, arguments: a });
  return { error: !!r.isError, text: r.content.map((c) => c.text).join('\n') };
};

// 2. before Chrome: clear Hebrew error
let r = await call('list_chats');
assert.ok(r.error && r.text.includes('פתח את WhatsApp Web בכרום ובדוק שהתוסף פעיל'), r.text);
console.log('✓ not connected → Hebrew error:', r.text);

// 3. Chrome with the test build exactly as released (dist/wa-reader-test-<version>.zip), loaded unpacked
const extVersion = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8')).version;
const extDir = path.join(tmp, 'extension');
execFileSync('unzip', ['-q', path.join(root, `dist/wa-reader-test-${extVersion}.zip`), '-d', extDir]);
const external = [];
const ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
  headless: true, channel: 'chromium',
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`]
});
const FAKE_WA = fs.readFileSync(path.join(root, 'test/fake-whatsapp.html'), 'utf8');
await ctx.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith('chrome-extension://')) return route.continue();
  if (u.startsWith('https://web.whatsapp.com/')) return route.fulfill({ contentType: 'text/html', body: FAKE_WA });
  if (u.startsWith('https://example.com/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>evil</title>' });
  external.push(u);
  return route.abort();
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
assert.equal(extId, DEV_EXTENSION_ID, 'dev "key" pins the extension ID');
console.log('✓ extension loaded with ID', extId);

// consent screen
const welcome = await ctx.newPage();
welcome.on('console', (m) => console.log('[welcome]', m.text()));
welcome.on('pageerror', (e) => console.log('[welcome error]', e.message));
await welcome.goto(`chrome-extension://${extId}/ui/welcome.html`);
await welcome.check('#ok');
await welcome.click('#go');
await welcome.waitForSelector('#done.show');

const wa = await ctx.newPage();
await wa.goto('https://web.whatsapp.com/');
await wa.waitForFunction(() => document.title === 'ready-check', null, { timeout: 2000 }).catch(() => {});

// 4. wait for the extension to connect, then call the tools
for (let i = 0; i < 40; i++) {
  r = await call('whatsapp_status');
  if (!r.error && r.text.startsWith('Connected')) break;
  await new Promise((res) => setTimeout(res, 500));
}
assert.ok(r.text.startsWith('Connected'), r.text);
console.log('✓ whatsapp_status:', r.text);

r = await call('list_chats', { limit: 10 });
assert.ok(!r.error && r.text.includes('Dana Cohen') && r.text.includes('Family'), r.text);
console.log('✓ list_chats:\n' + r.text);

r = await call('get_messages', { chat: 'Dana', limit: 200 });
assert.ok(!r.error && r.text.includes('Can you send the contract today?'), r.text);
console.log('✓ get_messages:\n' + r.text);

r = await call('search', { query: 'contract', limit: 100 });
assert.ok(!r.error && r.text.includes('1 matches'), r.text);
console.log('✓ search:', r.text.split('\n').pop());

r = await call('get_messages', { chat: 'Dana', limit: 201 });
assert.ok(r.error, 'limit > 200 must be rejected');
r = await call('search', { query: 'contract', limit: 101 });
assert.ok(r.error, 'limit > 100 must be rejected');
console.log('✓ limits enforced (get_messages ≤ 200, search ≤ 100)');

// popup: three lights on
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/ui/popup.html`);
await popup.waitForFunction(() => ['d1', 'd2', 'd3'].every((id) => document.getElementById(id)?.classList.contains('on')), null, { timeout: 8000 });
console.log('✓ popup: WhatsApp Web open · connected to Claude Desktop · ready');
if (process.env.E2E_SHOT) { await popup.setViewportSize({ width: 320, height: 330 }); await popup.screenshot({ path: process.env.E2E_SHOT }); }

// 5. a normal web page tries to open the WebSocket
const evil = await ctx.newPage();
await evil.goto('https://example.com/');
const fromPage = await evil.evaluate(() => new Promise((resolve) => {
  let opened = false;
  const ws = new WebSocket('ws://127.0.0.1:17345');
  ws.onopen = () => { opened = true; ws.send('{"id":1,"method":"listChats"}'); };
  ws.onclose = (e) => resolve({ opened, code: e.code });
  setTimeout(() => resolve({ opened, code: 'timeout' }), 5000);
}));
assert.equal(fromPage.opened, false, 'web page must not connect');
console.log('✓ web page WebSocket refused:', JSON.stringify(fromPage));

// the extension must still be the active connection
r = await call('whatsapp_status');
assert.ok(r.text.startsWith('Connected'), 'extension connection survives the attack: ' + r.text);

// 6. no external requests from the extension pages or the WA tab (except the stand-in page itself)
const wsLog = serverLog.join('');
console.log('first process log:\n' + firstLog.join('').trim().split('\n').map((l) => '   ' + l).join('\n'));
console.log('server log:\n' + wsLog.trim().split('\n').map((l) => '   ' + l).join('\n'));
console.log('blocked external requests:', external.length ? external : 'none');

await ctx.close();
await client.close();
first.kill();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nE2E OK');
