// WA Reader – service worker.
// Connects to the local wa-reader-mcp server (ws://127.0.0.1:<port>/ext) and answers its read-only
// queries by asking the open WhatsApp Web tab. Nothing is stored and nothing is sent anywhere else.
const WA_URL = 'https://web.whatsapp.com/*';
const CONSENT_VERSION = 2;
const DEFAULT_PORT = 47821;
const METHODS = new Set(['status', 'listChats', 'getMessages', 'recent', 'search']);

// ---------- settings & status ----------
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { port: DEFAULT_PORT, token: '', excludeChats: '', ...(settings || {}) };
  if (!s.token) { s.token = newToken(); await chrome.storage.local.set({ settings: s }); }
  return s;
}

const status = { ai: 'disconnected', aiError: '', waReady: false, me: '', lastQueryAt: 0, lastQuery: '' };
async function setStatus(patch) {
  Object.assign(status, patch);
  try { await chrome.storage.session.set({ status }); } catch { /* ignore */ }
}

// ---------- consent ----------
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
  await setStatus({ waReady: false, me: '' });
  await reloadWaTabs();
}

// ---------- WhatsApp tab ----------
async function findWaTab() {
  const tabs = await chrome.tabs.query({ url: WA_URL });
  return tabs[0] || null;
}

function excludeList(text) {
  return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

async function queryWhatsApp(method, params) {
  if (!METHODS.has(method)) throw new Error('unknown method');
  if (!(await hasConsent())) throw new Error('The WA Reader extension is installed but not activated. Ask the user to open the extension and click "Activate".');
  const tab = await findWaTab();
  if (!tab) {
    if (method === 'status') return { whatsappReady: false };
    throw new Error('WhatsApp Web is not open. Ask the user to open https://web.whatsapp.com in Chrome.');
  }
  const s = await getSettings();
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { kind: 'query', method, params: { ...params, exclude: excludeList(s.excludeChats) } });
  } catch {
    if (method === 'status') return { whatsappReady: false };
    throw new Error('The WhatsApp Web tab is not responding. Ask the user to refresh it (F5).');
  }
  if (!res?.ok) {
    if (method === 'status') return { whatsappReady: false };
    throw new Error(res?.error || 'WhatsApp Web error');
  }
  return method === 'status' ? { ...res.result, version: chrome.runtime.getManifest().version } : res.result;
}

// ---------- connection to the local MCP server ----------
let ws = null;
let pingTimer = null;
let retryTimer = null;
let backoff = 1000;

function disconnect() {
  clearInterval(pingTimer); clearTimeout(retryTimer);
  pingTimer = retryTimer = null;
  if (ws) { try { ws.onclose = null; ws.close(); } catch { /* ignore */ } }
  ws = null;
  setStatus({ ai: 'disconnected' });
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 30000);
}

async function connect() {
  if (!(await hasConsent())) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const s = await getSettings();
  let sock;
  try { sock = new WebSocket(`ws://127.0.0.1:${Number(s.port) || DEFAULT_PORT}/ext`); }
  catch { scheduleRetry(); return; }
  ws = sock;
  setStatus({ ai: 'connecting' });
  sock.onopen = () => sock.send(JSON.stringify({ type: 'hello', token: s.token, version: chrome.runtime.getManifest().version }));
  sock.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'welcome') {
      backoff = 1000;
      setStatus({ ai: 'connected', aiError: '' });
      clearInterval(pingTimer);
      // keeps the connection – and this service worker – alive while an AI tool is running
      pingTimer = setInterval(() => { try { sock.send('{"type":"ping"}'); } catch { /* ignore */ } }, 20000);
    } else if (msg.type === 'request') {
      let reply;
      setStatus({ lastQueryAt: Date.now(), lastQuery: msg.method });
      try { reply = { type: 'response', id: msg.id, ok: true, result: await queryWhatsApp(msg.method, msg.params || {}) }; }
      catch (e) { reply = { type: 'response', id: msg.id, ok: false, error: String(e?.message || e) }; }
      try { sock.send(JSON.stringify(reply)); } catch { /* ignore */ }
    }
  };
  sock.onclose = (ev) => {
    clearInterval(pingTimer); pingTimer = null;
    if (ws === sock) ws = null;
    const aiError = ev.code === 4003 ? 'הטוקן לא תואם להגדרת ה-MCP' : '';
    setStatus({ ai: 'disconnected', aiError });
    scheduleRetry();
  };
  sock.onerror = () => { /* onclose follows */ };
}

// Wakes the service worker to reconnect when no AI tool was running before.
function ensureAlarm() { chrome.alarms.create('reconnect', { periodInMinutes: 0.5 }); }
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'reconnect') connect(); });

async function boot() {
  if (await hasConsent()) { await registerScripts(); ensureAlarm(); connect(); }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await getSettings(); // creates the pairing token
  if (await hasConsent()) { await boot(); return; }
  await unregisterScripts();
  if (reason === 'install' || reason === 'update') chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
});
chrome.runtime.onStartup.addListener(boot);
boot();

// settings changes (port/token) → reconnect
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch.settings) { disconnect(); connect(); }
});

// ---------- messages from our pages and content script ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const fromWa = sender.tab && sender.url?.startsWith('https://web.whatsapp.com/') && sender.id === chrome.runtime.id;
    const fromUi = !sender.tab || sender.url?.startsWith(chrome.runtime.getURL(''));
    if (msg?.kind?.startsWith('wa_') ? !fromWa : !fromUi) return { ok: false, error: 'forbidden' };
    switch (msg?.kind) {
      case 'wa_ready':
        await setStatus({ waReady: true, me: msg.payload?.me || '' });
        return { ok: true };
      case 'wa_error':
        await setStatus({ waReady: false });
        return { ok: true };
      case 'consent':
        await grantConsent();
        return { ok: true };
      case 'revoke':
        await revokeConsent();
        return { ok: true };
      case 'newToken': {
        const s = await getSettings();
        await chrome.storage.local.set({ settings: { ...s, token: newToken() } });
        return { ok: true };
      }
      case 'state': {
        const tab = await findWaTab();
        const s = await getSettings();
        const consent = await hasConsent();
        let wa = { whatsappReady: false };
        if (tab && consent) wa = await Promise.race([queryWhatsApp('status', {}).catch(() => ({ whatsappReady: false })), new Promise((r) => setTimeout(() => r({ whatsappReady: false }), 4000))]);
        if (wa.whatsappReady) await setStatus({ waReady: true, me: wa.me || status.me });
        return { ok: true, consent, status: { ...status, waOpen: !!tab, waReady: !!wa.whatsappReady, chats: wa.chats || 0 }, settings: s };
      }
      case 'reconnect':
        disconnect(); connect();
        return { ok: true };
      default:
        return { ok: false, error: 'unknown' };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
