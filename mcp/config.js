// WA Reader – local MCP server configuration.
// Everything stays on this computer: the bridge listens on 127.0.0.1 only.

export const VERSION = '2.0.1';

// Fixed port the Chrome extension connects to (ws://127.0.0.1:17345).
export const PORT = 17345;
export const HOST = '127.0.0.1';

// Chrome Web Store ID of WA Reader.
export const STORE_EXTENSION_ID = 'pihiihgmfgefkneahjhmeamnmlfapmfp';
// ID of the unpacked development build (fixed by "key" in extension/manifest.json).
export const DEV_EXTENSION_ID = 'cphfcojbhpemojgolhcgngodbfodildd';

// Seconds to wait for the extension to answer one request.
export const REQUEST_TIMEOUT_MS = 15000;

const ID_RE = /^[a-p]{32}$/;

// Allowed extension IDs: WA_READER_EXTENSION_ID (comma separated), set from the .mcpb settings.
// Defaults to the Chrome Web Store ID. Each one is matched exactly against the Origin header.
export function allowedOrigins(env = process.env) {
  const raw = String(env.WA_READER_EXTENSION_ID || STORE_EXTENSION_ID);
  const ids = raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => ID_RE.test(s));
  if (!ids.length) ids.push(STORE_EXTENSION_ID);
  return new Set(ids.map((id) => `chrome-extension://${id}`));
}
