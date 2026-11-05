#!/usr/bin/env node
// wa-reader-mcp – local (stdio) MCP server for Claude Desktop / Claude Code / Cursor.
// Gives AI tools read-only, on-demand access to WhatsApp Web through the WA Reader Chrome extension
// over 127.0.0.1. Nothing is stored. The same tools also run in the cloud relay (supabase/functions/wa-mcp).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './bridge.js';
import { registerWhatsAppTools, INSTRUCTIONS, VERSION } from '../shared/tools.js';

const PORT = Number(process.env.WA_READER_PORT) || 47821;
const TOKEN = (process.env.WA_READER_TOKEN || '').trim();
const log = (m) => process.stderr.write(`[wa-reader-mcp] ${m}\n`); // stdout belongs to MCP

if (process.argv.includes('--version')) { console.log(VERSION); process.exit(0); }

const NO_TOKEN =
  'WA_READER_TOKEN is not set. Open the WA Reader extension → Settings, copy the ready-made MCP config ' +
  '(it contains the token) into this AI tool’s MCP settings, and restart the AI tool.';

const bridge = TOKEN.length >= 24 ? new Bridge({ port: PORT, token: TOKEN, log }) : null;
if (bridge) await bridge.start(); else log(NO_TOKEN);

const server = new McpServer({ name: 'wa-reader', version: VERSION }, { instructions: INSTRUCTIONS });
registerWhatsAppTools(server, async (method, params, timeoutMs) => {
  if (!bridge) throw new Error(NO_TOKEN);
  return bridge.call(method, params, timeoutMs);
});

await server.connect(new StdioServerTransport());
log(`ready (v${VERSION}, port ${PORT}, ${bridge ? bridge.role : 'no token'})`);

const shutdown = () => { bridge?.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.stdin.on('close', shutdown);
