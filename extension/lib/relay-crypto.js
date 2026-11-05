// WA Reader – end-to-end crypto for the cloud relay (runs in Chrome and in Deno/Supabase).
// The per-install secret never leaves the user's extension except inside the connector URL the user
// pastes into Claude. From it both sides derive (HMAC-SHA256):
//   - the Realtime topic name (unguessable), and
//   - an AES-256-GCM key. Every request and response on the channel is gzip + AES-GCM sealed, so
//     Supabase Realtime only ever relays ciphertext, and nobody who learns the topic can read or forge messages.
const te = new TextEncoder();
const td = new TextDecoder();

export function b64uEncode(bytes) {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url
export function newSecret() { return b64uEncode(crypto.getRandomValues(new Uint8Array(32))); }

async function hmac(keyBytes, label) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, te.encode(label)));
}

export async function deriveRelay(secret) {
  if (!SECRET_RE.test(secret)) throw new Error('bad secret');
  const s = b64uDecode(secret);
  const chan = Array.from(await hmac(s, 'wa-reader/channel/v1'), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
  const key = await crypto.subtle.importKey('raw', await hmac(s, 'wa-reader/key/v1'), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { topic: 'wa-' + chan, key };
}

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function seal(key, obj) {
  const plain = await pipe(te.encode(JSON.stringify(obj)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64uEncode(out);
}

export async function open(key, sealed) {
  const b = b64uDecode(sealed);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, key, b.subarray(12)));
  return JSON.parse(td.decode(await pipe(plain, new DecompressionStream('gzip'))));
}

export function randomId() { return b64uEncode(crypto.getRandomValues(new Uint8Array(12))); }
