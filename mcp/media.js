// Saving the one file get_media asked for. This is the only place WA Reader writes to disk.
//   - folder: <Downloads>/WA Reader (WA_READER_MEDIA_DIR overrides it); the system temp folder if that fails
//   - the file name comes from another person (WhatsApp sender), so it is reduced to a plain, safe name
//   - an existing file is never overwritten
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const INLINE_IMAGE_MAX_BYTES = 700 * 1024; // Claude Desktop limits one tool answer to about 1 MB
export const INLINE_AUDIO_MAX_BYTES = 700 * 1024; // a voice message of about 5 minutes
export const INLINE_TEXT_MAX_BYTES = 100 * 1024;

const KIND = { image: 'image', video: 'video', gif: 'GIF', ptv: 'video note', ptt: 'voice message', audio: 'audio', document: 'document', sticker: 'sticker' };
export const kindOf = (type) => KIND[type] || 'file';

export function humanSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/flac': 'flac',
  'application/pdf': 'pdf', 'application/zip': 'zip', 'application/json': 'json', 'application/xml': 'xml',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv', 'text/html': 'html', 'text/markdown': 'md', 'text/vcard': 'vcf', 'text/calendar': 'ics'
};
const baseMime = (mime) => String(mime || '').split(';')[0].trim().toLowerCase(); // "audio/ogg; codecs=opus" → "audio/ogg"
export const audioMime = (mime) => baseMime(mime); // what goes in the MCP audio block: "audio/ogg"
export const extFor = (mime) => EXT[baseMime(mime)] || 'bin';

const TEXT_EXT = /\.(txt|csv|tsv|json|md|xml|html?|log|ics|vcf|ya?ml)$/i;
export function isTextLike(mime, filename) {
  const b = baseMime(mime);
  return b.startsWith('text/') || b === 'application/json' || b === 'application/xml' || (b === 'application/octet-stream' && TEXT_EXT.test(String(filename || '')));
}

// A name that is safe on Windows, macOS and Linux: no folders, no control or direction-override characters,
// no reserved characters or device names, no leading dot, bounded length.
export function safeName(name, fallback = 'file') {
  let s = String(name || '').normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s)) s = '_' + s;
  if (s.length > 100) {
    const ext = path.extname(s).slice(0, 12);
    s = s.slice(0, 100 - ext.length).replace(/[. ]+$/g, '') + ext;
  }
  return s || fallback;
}

export function mediaDir(env = process.env) {
  const custom = String(env.WA_READER_MEDIA_DIR || '').trim();
  return custom ? path.resolve(custom) : path.join(os.homedir(), 'Downloads', 'WA Reader');
}

function stamp(sec) {
  const d = sec ? new Date(sec * 1000) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
}

export function fileNameFor({ mime, type, filename, chatName, t }) {
  const ext = extFor(mime);
  let base = safeName(String(filename || '').split(/[\\/]/).pop(), ''); // only the last part: a sender cannot name folders
  if (base) {
    // a document keeps its own name; add the real extension when it has none
    if (!path.extname(base) && ext !== 'bin') base += '.' + ext;
  } else {
    base = `${safeName(chatName, 'chat').slice(0, 40)} ${kindOf(type)}.${ext}`;
  }
  return safeName(`${stamp(t)} ${base}`);
}

async function writeNew(dir, name, data) {
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  for (let i = 1; i <= 200; i++) {
    const file = path.join(dir, i === 1 ? name : `${stem} (${i})${ext}`);
    try { await fs.writeFile(file, data, { flag: 'wx', mode: 0o600 }); return file; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('too many files with the same name');
}

// Returns the full path of the saved file.
export async function saveMedia({ data, mime, type, filename, chatName, t }, env = process.env) {
  const name = fileNameFor({ mime, type, filename, chatName, t });
  try { return await writeNew(mediaDir(env), name, data); }
  catch (first) {
    try { return await writeNew(path.join(os.tmpdir(), 'WA Reader'), name, data); }
    catch { throw new Error(`לא הצלחתי לשמור את הקובץ בתיקייה ${mediaDir(env)}: ${first.message}`); }
  }
}
