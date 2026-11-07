// WA Reader – local MCP server configuration.
// Everything stays on this computer: the bridge listens on 127.0.0.1 only.

export const VERSION = '2.3.0';

// Fixed port the Chrome extension connects to (ws://127.0.0.1:17345).
export const PORT = 17345;
export const HOST = '127.0.0.1';

// Chrome Web Store ID of WA Reader.
export const STORE_EXTENSION_ID = 'pihiihgmfgefkneahjhmeamnmlfapmfp';
// ID of the test build, wa-reader-test-<version>.zip (fixed by "key" in extension/manifest.json).
export const DEV_EXTENSION_ID = 'cphfcojbhpemojgolhcgngodbfodildd';

// Seconds to wait for the extension to answer one request.
export const REQUEST_TIMEOUT_MS = 15000;

const ID_RE = /^[a-p]{32}$/;

// Allowed extension IDs, each matched exactly against the Origin header: the Chrome Web Store build and the
// test build (its ID is fixed by "key"), so neither needs any setting. The check is what keeps web pages and
// other browser extensions out – browsers cannot fake Origin. (Programs already running on this computer can
// fake any header, so a secret ID would add nothing.) Developers can override the list with
// WA_READER_EXTENSION_ID (comma separated).
export function allowedOrigins(env = process.env) {
  const raw = String(env.WA_READER_EXTENSION_ID || `${STORE_EXTENSION_ID},${DEV_EXTENSION_ID}`);
  // keep only a–z: drops spaces, quotes and invisible direction marks (LRM/RLM) that get copied
  // along with the ID from Chrome's right-to-left (e.g. Hebrew) extensions page
  const ids = raw.split(/[,;\s]+/).map((s) => s.toLowerCase().replace(/[^a-z]/g, '')).filter((s) => ID_RE.test(s));
  if (!ids.length) ids.push(STORE_EXTENSION_ID, DEV_EXTENSION_ID);
  return new Set(ids.map((id) => `chrome-extension://${id}`));
}
