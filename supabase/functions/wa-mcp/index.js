// WA Reader – remote MCP server (Supabase Edge Function).
// URL: https://wa.m-eitan.co.il (Vercel proxy, see /vercel) or https://<project>.supabase.co/functions/v1/wa-mcp
// Sign-in: Claude runs a stateless OAuth flow (oauth.js) – the user pastes the URL, clicks Connect and approves
// in the browser; the access token carries their personal relay key, sealed. The x-api-key header still works
// for clients that can't do OAuth. The key is never put in the URL, so it never appears in request logs.
// Stateless: every tool call is relayed to the extension and the answer is returned to Claude. Nothing is stored.
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/webStandardStreamableHttp.js';
import { registerWhatsAppTools, INSTRUCTIONS, VERSION } from './tools.js';
import { relayCall } from './relay.js';
import { SECRET_RE } from './relay-crypto.js';
import { handleOAuth, secretFromBearer, unauthorized, baseUrl } from './oauth.js';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/^.*?\/wa-mcp(?=\/|$)/, '').replace(/\/+$/, '');
  if (path) {
    try {
      return (await handleOAuth(req, path)) || json(404, { error: 'not_found' });
    } catch {
      return json(500, { error: 'server_error' });
    }
  }

  if (req.method !== 'POST') return json(405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  const header = (req.headers.get('x-api-key') || req.headers.get('x-wa-reader-key') || '').trim();
  const secret = SECRET_RE.test(header) ? header : await secretFromBearer(req);
  if (!secret) return unauthorized(baseUrl(req));

  const server = new McpServer({ name: 'wa-reader', version: VERSION }, { instructions: INSTRUCTIONS });
  registerWhatsAppTools(server, (method, params, timeoutMs) => relayCall(secret, method, params, timeoutMs));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } catch {
    return json(500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  }
});
