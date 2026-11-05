// Stateless OAuth 2.1 for the WA Reader connector, so users only paste a URL into Claude and click "Connect".
// Nothing is stored: client registrations are not persisted, and codes/tokens are the user's relay secret
// sealed (AES-256-GCM) with a server key derived from the project's service-role key.
// The consent page lives on GitHub Pages (Supabase serves HTML from functions as text/plain);
// it gets the secret from the user's extension and asks /oauth/code to seal it into a one-time code.
import { seal, open, b64uEncode, SECRET_RE } from './relay-crypto.js';

export const FN_URL = (Deno.env.get('SUPABASE_URL') || 'https://igmqqdexoqwulvknvrnj.supabase.co') + '/functions/v1/wa-mcp';
// Branded URL (Vercel proxy, see /vercel). It rewrites to this function with ?_via=wa, so we advertise our
// OAuth URLs on whichever host the client actually connected to (RFC 9728 requires the resource to match).
export const PUBLIC_URL = 'https://wa.m-eitan.co.il';
export const baseUrl = (req) => new URL(req.url).searchParams.get('_via') === 'wa' ? PUBLIC_URL : FN_URL;
export const CONNECT_PAGE = 'https://kobibest.github.io/wa-reader/connect.html';
const PAGE_ORIGIN = new URL(CONNECT_PAGE).origin;
const SCOPE = 'whatsapp.read';
const AT_TTL = 30 * 86400;       // access token: 30 days
const RT_TTL = 365 * 86400;      // refresh token: 1 year (rotated on every use)
const CODE_TTL = 300;            // authorization code: 5 minutes

// Claude (web, desktop, mobile) and Claude Code / other local clients (loopback, any port)
export function redirectAllowed(uri) {
  let u; try { u = new URL(uri); } catch { return false; }
  if (u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname) && u.pathname === '/api/mcp/auth_callback') return true;
  if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && !u.username && !u.password) return true;
  return false;
}

let serverKey;
async function key() {
  if (serverKey) return serverKey;
  const base = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_DB_URL');
  if (!base) throw new Error('server key unavailable');
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(base), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('wa-reader/oauth/v1'));
  serverKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return serverKey;
}
const now = () => Math.floor(Date.now() / 1000);
const mint = async (obj) => 'war_' + await seal(await key(), obj);
async function unseal(tok, typ) {
  if (typeof tok !== 'string' || !tok.startsWith('war_') || tok.length > 4000) return null;
  try {
    const o = await open(await key(), tok.slice(4));
    if (o?.typ !== typ || !SECRET_RE.test(o.s) || !(o.exp > now())) return null;
    return o;
  } catch { return null; }
}

/** Returns the relay secret for a valid "Authorization: Bearer" access token, else null. */
export async function secretFromBearer(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const o = await unseal(m[1], 'at');
  return o ? o.s : null;
}

const cors = { 'Access-Control-Allow-Origin': PAGE_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };
const j = (status, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const oerr = (status, error, description) => j(status, { error, error_description: description });

export function unauthorized(base = FN_URL) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", scope="${SCOPE}"`,
    },
  });
}

const asMetadata = (base) => ({
  issuer: base,
  authorization_endpoint: CONNECT_PAGE,
  token_endpoint: `${base}/oauth/token`,
  registration_endpoint: `${base}/oauth/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  scopes_supported: [SCOPE],
  subject_types_supported: ['public'],
  // OIDC discovery fields some clients require (we issue no ID tokens)
  jwks_uri: `${base}/.well-known/jwks.json`,
  id_token_signing_alg_values_supported: ['RS256'],
  service_documentation: 'https://github.com/kobibest/wa-reader',
});

async function s256(verifier) {
  return b64uEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

async function tokens(s) {
  return {
    access_token: await mint({ typ: 'at', s, exp: now() + AT_TTL }),
    token_type: 'Bearer',
    expires_in: AT_TTL,
    refresh_token: await mint({ typ: 'rt', s, exp: now() + RT_TTL }),
    scope: SCOPE,
  };
}

/** Handles the OAuth routes. `path` is the part after /wa-mcp. Returns a Response, or null if not an OAuth route. */
export async function handleOAuth(req, path) {
  const method = req.method;
  const base = baseUrl(req);
  if (method === 'GET' && (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/')) {
    return j(200, { resource: base, authorization_servers: [base], scopes_supported: [SCOPE], bearer_methods_supported: ['header'], resource_name: 'WA Reader (WhatsApp)' });
  }
  if (method === 'GET' && (path === '/.well-known/openid-configuration' || path === '/.well-known/oauth-authorization-server')) {
    return j(200, asMetadata(base));
  }
  if (method === 'GET' && path === '/.well-known/jwks.json') return j(200, { keys: [] });

  if (path === '/oauth/register' && method === 'POST') {
    let body; try { body = await req.json(); } catch { return oerr(400, 'invalid_client_metadata', 'JSON body required'); }
    const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
    if (!uris.length || !uris.every(redirectAllowed)) return oerr(400, 'invalid_redirect_uri', 'Only Claude callback URLs are allowed');
    return j(201, {
      client_id: 'wa-' + b64uEncode(crypto.getRandomValues(new Uint8Array(12))),
      client_id_issued_at: now(),
      client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : 'Claude',
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: SCOPE,
    });
  }

  if (path === '/oauth/code') {
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (method !== 'POST') return j(405, { error: 'method_not_allowed' }, cors);
    if (req.headers.get('origin') !== PAGE_ORIGIN) return j(403, { error: 'forbidden' }, cors);
    let b; try { b = await req.json(); } catch { return j(400, { error: 'invalid_request' }, cors); }
    if (!SECRET_RE.test(b?.secret || '')) return j(400, { error: 'invalid_request', error_description: 'bad key' }, cors);
    if (!redirectAllowed(b.redirect_uri)) return j(400, { error: 'invalid_request', error_description: 'redirect_uri not allowed' }, cors);
    if (b.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(b.code_challenge || '')) return j(400, { error: 'invalid_request', error_description: 'PKCE S256 required' }, cors);
    const code = await mint({ typ: 'code', s: b.secret, ru: b.redirect_uri, cc: b.code_challenge, cid: String(b.client_id || ''), exp: now() + CODE_TTL });
    return j(200, { code }, cors);
  }

  if (path === '/oauth/token') {
    if (method !== 'POST') return oerr(405, 'invalid_request', 'POST required');
    let p;
    try {
      const ct = req.headers.get('content-type') || '';
      p = ct.includes('application/json') ? new URLSearchParams(await req.json()) : new URLSearchParams(await req.text());
    } catch { return oerr(400, 'invalid_request', 'bad body'); }
    const grant = p.get('grant_type');
    if (grant === 'authorization_code') {
      const c = await unseal(p.get('code'), 'code');
      if (!c) return oerr(400, 'invalid_grant', 'code invalid or expired');
      if (p.get('redirect_uri') && p.get('redirect_uri') !== c.ru) return oerr(400, 'invalid_grant', 'redirect_uri mismatch');
      if (c.cid && p.get('client_id') && p.get('client_id') !== c.cid) return oerr(400, 'invalid_grant', 'client_id mismatch');
      const v = p.get('code_verifier') || '';
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(v) || await s256(v) !== c.cc) return oerr(400, 'invalid_grant', 'PKCE verification failed');
      return j(200, await tokens(c.s));
    }
    if (grant === 'refresh_token') {
      const r = await unseal(p.get('refresh_token'), 'rt');
      if (!r) return oerr(400, 'invalid_grant', 'refresh token invalid or expired');
      return j(200, await tokens(r.s));
    }
    return oerr(400, 'unsupported_grant_type', 'unsupported grant_type');
  }
  return null;
}
