// WA Reader – remote MCP server (Supabase Edge Function).
// URL: https://<project>.supabase.co/functions/v1/wa-mcp
// The user's personal key (created by their extension) is sent by Claude in the X-WA-Reader-Key request header,
// not in the URL, so it never appears in request logs.
// Stateless: every tool call is relayed to the extension and the answer is returned to Claude. Nothing is stored.
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/webStandardStreamableHttp.js';
import { registerWhatsAppTools, INSTRUCTIONS, VERSION } from './tools.js';
import { relayCall } from './relay.js';
import { SECRET_RE } from './relay-crypto.js';

const NO_KEY = 'This WhatsApp connector has no valid personal key. Ask the user to open the WA Reader extension → Settings → "Connect to Claude", and add the X-WA-Reader-Key request header shown there to this connector in Claude (Customize → Connectors).';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  // initialize / tools/list work without the key (they reveal nothing); tool calls need it
  const secret = (req.headers.get('x-wa-reader-key') || '').trim();
  const hasKey = SECRET_RE.test(secret);

  const server = new McpServer({ name: 'wa-reader', version: VERSION }, { instructions: INSTRUCTIONS });
  registerWhatsAppTools(server, (method, params, timeoutMs) => {
    if (!hasKey) throw new Error(NO_KEY);
    return relayCall(secret, method, params, timeoutMs);
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } catch {
    return json(500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  }
});
