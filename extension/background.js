// WA Reader – service worker.
// Connects to the local WA Reader MCP server that Claude Desktop runs (ws://127.0.0.1:17345) and answers its
// read-only requests by asking the open WhatsApp Web tab. That is the only connection this extension makes:
// no other servers, no telemetry. Messages are never stored – each request is answered from memory and forgotten.

const WA_URL = 'https://web.whatsapp.com/*';
const BRIDGE_URL = 'ws://127.0.0.1:17345';
const CONSENT_VERSION = 4;           // 4 = local-only 2.0 (no cloud relay)
const QUERY_TIMEOUT_MS = 14000;      // the MCP server gives up after 15 s
const PING_MS = 20000;               // keeps the WebSocket – and this service worker – alive (Chrome 116+)
const METHODS = new Set(['status', 'listChats', 'getMessages', 'search']);

// In-memory status only (shown in the popup)
const status = { bridge: 'disconnected', waReady: false, lastQueryAt: 0 };

// ---------- consent & content scripts ----------
const SCRIPTS = [
  { id: 'wa-bridge', matches: [WA_URL], js: ['bridge.js'], runAt: 'document_start', world: 'ISOLATED' },
  { id: 'wa-page', matches: [WA_URL], js: ['page/config.js', 'page/wppconnect-wa.js', 'page/page.js'], runAt: 'document_idle', world: 'MAIN' }
];

async function hasConsent() {
  const { consent } = await chrome.storage.local.get('consent');
  return consent?.version === CONSENT_VERSION;
}

async function registerScripts() {
  const existing = new Set((await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id));
  const missing = SCRIPTS.filter((s) => !existing.has(s.id));
  if (missing.length) await chrome.scripting.registerContentScripts(missing.map((s) => ({ ...s, persistAcrossSessions: true })));
}

async function unregisterScripts() {
  const ids = (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
}

async function reloadWaTabs() {
  for (const t of await chrome.tabs.query({ url: WA_URL })) chrome.tabs.reload(t.id).catch(() => {});
}

async function grantConsent() {
  await chrome.storage.local.set({ consent: { version: CONSENT_VERSION, at: Date.now() } });
  await registerScripts();
  await reloadWaTabs();
  ensureAlarm();
  connect();
}

async function revokeConsent() {
  disconnect();
  await chrome.alarms.clearAll();
  await unregisterScripts();
  await chrome.storage.local.remove('consent');
  status.waReady = false;
  await reloadWaTabs();
}

// ---------- WhatsApp tab ----------
async function findWaTab() {
  const tabs = await chrome.tabs.query({ url: WA_URL });
  return tabs[0] || null;
}

async function excludeList() {
  const { settings } = await chrome.storage.local.get('settings');
  return String(settings?.excludeChats || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

async function queryWhatsApp(method, params) {
  if (!METHODS.has(method)) throw new Error('unknown method');
  if (!(await hasConsent())) throw new Error('התוסף WA Reader מותקן אבל לא הופעל. פתח את התוסף בכרום ולחץ "הפעל".');
  const tab = await findWaTab();
  if (!tab) {
    if (method === 'status') return { whatsappReady: false };
    throw new Error('WhatsApp Web לא פתוח. פתח את https://web.whatsapp.com בכרום ונסה שוב.');
  }
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { kind: 'query', method, params: { ...params, exclude: await excludeList() }, timeoutMs: QUERY_TIMEOUT_MS });
  } catch {
    if (method === 'status') return { whatsappReady: false };
    throw new Error('הטאב של WhatsApp Web לא מגיב. רענן אותו (F5) ונסה שוב.');
  }
  if (!res?.ok) {
    if (method === 'status') return { whatsappReady: false };
    throw new Error(res?.error || 'שגיאה ב-WhatsApp Web');
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return method === 'status' ? { ...res.result, version: chrome.runtime.getManifest().version, tz } : { ...res.result, tz };
}

// ---------- connection to the local MCP server (Claude Desktop) ----------
let ws = null;
let pingTimer = null;
let retryTimer = null;
let backoff = 1000;

function disconnect() {
  clearInterval(pingTimer); clearTimeout(retryTimer);
  pingTimer = retryTimer = null;
  if (ws) { try { ws.onclose = null; ws.close(); } catch { /* ignore */ } }
  ws = null;
  status.bridge = 'disconnected';
}

function scheduleRetry(delay = backoff) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, delay);
  backoff = Math.min(backoff * 2, 30000);
}

async function connect() {
  if (!(await hasConsent())) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  let sock;
  try { sock = new WebSocket(BRIDGE_URL); } catch { scheduleRetry(); return; }
  ws = sock;
  status.bridge = 'connecting';
  sock.onopen = () => {
    backoff = 1000;
    status.bridge = 'connected';
    clearInterval(pingTimer);
    pingTimer = setInterval(() => { try { sock.send('{"type":"ping"}'); } catch { /* ignore */ } }, PING_MS);
  };
  sock.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || msg.id === undefined || typeof msg.method !== 'string') return; // pong etc.
    status.lastQueryAt = Date.now();
    let reply;
    try { reply = { id: msg.id, result: await queryWhatsApp(msg.method, msg.params || {}) }; }
    catch (e) { reply = { id: msg.id, error: String(e?.message || e) }; }
    try { sock.send(JSON.stringify(reply)); } catch { /* ignore */ }
  };
  sock.onclose = (ev) => {
    clearInterval(pingTimer); pingTimer = null;
    if (ws === sock) ws = null;
    status.bridge = 'disconnected';
    // 4000 = another connection (e.g. a second Chrome profile) took over – back off longer
    scheduleRetry(ev.code === 4000 ? 30000 : backoff);
  };
  sock.onerror = () => { /* onclose follows */ };
}

// Wakes the service worker every 30 s to reconnect while Claude Desktop is not running.
function ensureAlarm() { chrome.alarms.create('reconnect', { periodInMinutes: 0.5 }); }
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'reconnect') connect(); });

// ---------- startup & migration from earlier versions ----------
// Earlier versions kept a pairing token, a cloud-relay key and a port in chrome.storage. 2.0 needs none of them.
async function cleanupOldStorage() {
  const { settings } = await chrome.storage.local.get('settings');
  const excludeChats = settings?.excludeChats || '';
  await chrome.storage.local.remove(['settings', 'status', 'migratedV2', 'reconsentShown']);
  if (excludeChats) await chrome.storage.local.set({ settings: { excludeChats } });
  try { await chrome.storage.session.clear(); } catch { /* ignore */ }
}

async function boot() {
  if (await hasConsent()) { await registerScripts(); ensureAlarm(); connect(); return; }
  await unregisterScripts();
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await cleanupOldStorage();
  if (reason === 'install' || (reason === 'update' && !(await hasConsent()))) {
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
  }
});
chrome.runtime.onStartup.addListener(boot);
boot();

// ---------- messages from our pages and the WhatsApp content script ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (sender.id !== chrome.runtime.id) return { ok: false, error: 'forbidden' };
    const fromWa = !!sender.tab && !!sender.url?.startsWith('https://web.whatsapp.com/');
    const fromUi = !sender.tab || !!sender.url?.startsWith(chrome.runtime.getURL(''));
    const allowed = msg?.kind?.startsWith('wa_') ? fromWa : fromUi;
    if (!allowed) return { ok: false, error: 'forbidden' };
    switch (msg?.kind) {
      case 'wa_ready': status.waReady = true; return { ok: true };
      case 'wa_error': status.waReady = false; return { ok: true };
      case 'consent': await grantConsent(); return { ok: true };
      case 'revoke': await revokeConsent(); return { ok: true };
      case 'state': {
        const consent = await hasConsent();
        const tab = await findWaTab();
        let wa = { whatsappReady: false };
        if (tab && consent) {
          wa = await Promise.race([
            queryWhatsApp('status', {}).catch(() => ({ whatsappReady: false })),
            new Promise((r) => setTimeout(() => r({ whatsappReady: false }), 4000))
          ]);
        }
        status.waReady = !!wa.whatsappReady;
        if (consent && status.bridge === 'disconnected') { backoff = 1000; connect(); }
        return { ok: true, consent, status: { ...status, waOpen: !!tab, chats: wa.chats || 0 } };
      }
      default:
        return { ok: false, error: 'unknown' };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
