// get_media: file names that come from WhatsApp senders must be safe, and files are never overwritten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { safeName, fileNameFor, saveMedia, extFor, isTextLike, humanSize, mediaDir } from '../mcp/media.js';
import { registerTools } from '../mcp/tools.js';

test('file names from senders are reduced to a plain safe name', () => {
  assert.equal(safeName('../../etc/passwd'), '_.._etc_passwd');
  assert.equal(safeName('..\\..\\Windows\\x.exe'), '_.._Windows_x.exe');
  assert.equal(safeName('.bashrc'), 'bashrc');
  assert.equal(safeName('a:b*c?"<>|.pdf'), 'a_b_c_____.pdf');
  assert.equal(safeName('invoice\u202Efdp.exe'), 'invoicefdp.exe'); // right-to-left override removed
  assert.equal(safeName('CON.txt'), '_CON.txt');
  assert.equal(safeName('  ...  '), 'file');
  assert.equal(safeName('חוזה שכירות.pdf'), 'חוזה שכירות.pdf');
  const long = safeName('x'.repeat(300) + '.pdf');
  assert.ok(long.length <= 100 && long.endsWith('.pdf'));
  for (const n of ['../x', '/abs/x', 'C:\\x', 'a/b\\c']) assert.equal(path.basename(safeName(n)), safeName(n));
});

test('names and extensions', () => {
  assert.equal(extFor('audio/ogg; codecs=opus'), 'ogg');
  assert.equal(extFor('application/pdf'), 'pdf');
  assert.equal(extFor('weird/thing'), 'bin');
  const t = Math.floor(new Date(2026, 10, 5, 8, 7).getTime() / 1000);
  assert.equal(fileNameFor({ mime: 'audio/ogg; codecs=opus', type: 'ptt', chatName: 'Dana Cohen', t }), '2026-11-05 08.07 Dana Cohen voice message.ogg');
  assert.equal(fileNameFor({ mime: 'application/pdf', type: 'document', filename: 'contract.pdf', chatName: 'Dana', t }), '2026-11-05 08.07 contract.pdf');
  assert.equal(fileNameFor({ mime: 'application/pdf', type: 'document', filename: 'contract', chatName: 'Dana', t }), '2026-11-05 08.07 contract.pdf');
  assert.ok(isTextLike('text/csv') && isTextLike('application/octet-stream', 'a.json') && !isTextLike('application/pdf', 'a.pdf'));
  assert.equal(humanSize(34000), '33 KB');
  assert.equal(mediaDir({}), path.join(os.homedir(), 'Downloads', 'WA Reader'));
});

test('saves into the folder, never overwrites, never leaves it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-media-'));
  const env = { WA_READER_MEDIA_DIR: dir };
  const a = await saveMedia({ data: Buffer.from('one'), mime: 'application/pdf', type: 'document', filename: '../../evil.pdf', chatName: 'x', t: 1 }, env);
  const b = await saveMedia({ data: Buffer.from('two'), mime: 'application/pdf', type: 'document', filename: '../../evil.pdf', chatName: 'x', t: 1 }, env);
  assert.notEqual(a, b);
  assert.equal(path.dirname(a), dir);
  assert.equal(path.dirname(b), dir);
  assert.equal(fs.readFileSync(a, 'utf8'), 'one');
  assert.equal(fs.readFileSync(b, 'utf8'), 'two');
  fs.rmSync(dir, { recursive: true, force: true });
});

// the tool itself, with a stand-in for the Chrome extension
function tools(call) {
  const reg = {};
  registerTools({ registerTool: (name, def, fn) => { reg[name] = { def, fn }; } }, call);
  return reg;
}
const msg = (over) => ({ id: 'false_1@c.us_AB', chatId: '1@c.us', chatName: 'Dana', fromMe: false, sender: 'Dana', t: 1762300000, text: '[x]', ...over });

test('get_media: an image is shown to Claude and not saved; save: true also saves it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-media-'));
  process.env.WA_READER_MEDIA_DIR = dir;
  const png = Buffer.from('fake-png').toString('base64');
  const seen = [];
  const t = tools(async (method, params, timeoutMs) => {
    seen.push([method, params, timeoutMs]);
    return { chat: { name: 'Dana' }, message: msg({ type: 'image', media: { mime: 'image/png', size: 8 } }), mime: 'image/png', size: 8, base64: png, tz: 'UTC' };
  });
  let r = await t.get_media.fn({ media_id: 'false_1@c.us_AB' });
  assert.deepEqual(seen[0], ['getMedia', { messageId: 'false_1@c.us_AB' }, 45000]);
  assert.deepEqual(r.content[1], { type: 'image', data: png, mimeType: 'image/png' });
  assert.match(r.content[0].text, /not saved to disk/);
  assert.equal(fs.readdirSync(dir).length, 0);
  r = await t.get_media.fn({ media_id: 'false_1@c.us_AB', save: true });
  assert.equal(fs.readdirSync(dir).length, 1);
  assert.match(r.content[0].text, /Saved to: /);
  assert.equal(t.get_media.def.annotations.readOnlyHint, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('get_media: a voice message goes to Claude as it is and is not saved; a small text file is also returned as text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-media-'));
  process.env.WA_READER_MEDIA_DIR = dir;
  let answer = { chat: { name: 'Dana' }, message: msg({ type: 'ptt', text: '[voice message 0:12]', media: { mime: 'audio/ogg; codecs=opus', size: 5, duration: 12 } }), mime: 'audio/ogg; codecs=opus', base64: Buffer.from('OggS!').toString('base64'), tz: 'UTC' };
  const t = tools(async () => answer);
  let r = await t.get_media.fn({ media_id: 'false_1@c.us_AB' });
  assert.equal(fs.readdirSync(dir).length, 0, 'nothing is written to disk');
  assert.deepEqual(r.content[1], { type: 'audio', data: Buffer.from('OggS!').toString('base64'), mimeType: 'audio/ogg' });
  assert.ok(/not saved to disk/.test(r.content[0].text) && r.content[0].text.includes('0:12') && /transcription tool connected to Claude/.test(r.content[0].text));
  // a long recording is neither attached nor saved, unless save is asked for
  const big = Buffer.alloc(800 * 1024, 1).toString('base64');
  r = await tools(async () => ({ ...answer, base64: big })).get_media.fn({ media_id: 'false_1@c.us_AB' });
  assert.equal(r.content.length, 1);
  assert.match(r.content[0].text, /too long to attach/);
  assert.equal(fs.readdirSync(dir).length, 0);
  r = await t.get_media.fn({ media_id: 'false_1@c.us_AB', save: true });
  const [file] = fs.readdirSync(dir);
  assert.match(file, /Dana voice message\.ogg$/);
  assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), 'OggS!');
  assert.ok(r.content[0].text.includes(path.join(dir, file)) && r.content[1].type === 'audio');
  fs.rmSync(path.join(dir, file));

  answer = { chat: { name: 'Dana' }, message: msg({ type: 'document', text: '[document: list.csv]', media: { mime: 'text/csv', size: 7, filename: 'list.csv' } }), mime: 'text/csv', base64: Buffer.from('a,b\n1,2').toString('base64'), tz: 'UTC' };
  r = await t.get_media.fn({ media_id: 'false_1@c.us_AB' });
  assert.match(r.content[1].text, /a,b\n1,2/);
  assert.equal(fs.readdirSync(dir).length, 1);

  answer = { message: null };
  r = await t.get_media.fn({ media_id: 'false_1@c.us_ZZ' });
  assert.ok(r.isError);
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.WA_READER_MEDIA_DIR;
});

test('get_messages prints a media_id only for messages that carry a file', async () => {
  const t = tools(async () => ({ tz: 'UTC', chat: { id: '1@c.us', name: 'Dana' }, messages: [
    msg({ id: 'false_1@c.us_AA', type: 'chat', text: 'hello', media: null }),
    msg({ id: 'false_1@c.us_AB', type: 'ptt', text: '[voice message 0:12]', media: { mime: 'audio/ogg', size: 34000, duration: 12 } })
  ] }));
  const out = (await t.get_messages.fn({ chat: 'Dana' })).content[0].text;
  assert.match(out, /\[voice message 0:12\] \{media_id: false_1@c\.us_AB, 33 KB\}/);
  assert.equal(out.match(/media_id/g).length, 1);
});
