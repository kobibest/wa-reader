#!/usr/bin/env node
// WA Reader – local MCP server for Claude Desktop (packaged as wa-reader.mcpb).
//   - MCP over stdio (Claude Desktop starts this process)
//   - in the same process: a WebSocket server on 127.0.0.1:17345 that only the WA Reader Chrome extension may join
// No external network calls, no telemetry, nothing stored on disk.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './bridge.js';
import { registerTools, INSTRUCTIONS } from './tools.js';
import { VERSION, HOST, PORT, REQUEST_TIMEOUT_MS, allowedOrigins } from './config.js';

const log = (m) => process.stderr.write(`[wa-reader] ${m}\n`); // stdout belongs to MCP

if (process.argv.includes('--version')) { process.stdout.write(VERSION + '\n'); process.exit(0); }

const origins = allowedOrigins();
const bridge = new Bridge({ host: HOST, port: PORT, origins, timeoutMs: REQUEST_TIMEOUT_MS, log });
bridge.start();

const server = new McpServer({ name: 'wa-reader', version: VERSION }, { instructions: INSTRUCTIONS });
registerTools(server, (method, params) => bridge.call(method, params));
await server.connect(new StdioServerTransport());
log(`ready v${VERSION}, allowed: ${[...origins].join(' ')}`);

const shutdown = () => { bridge.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.stdin.on('close', shutdown);
