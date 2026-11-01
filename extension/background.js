// WA Reader – service worker.
import { putMessages, getRange, count, pruneOlderThan, clearAll } from './lib/db.js';
import { getSettings, excludeMatcher, startOfDay, ymd, toMarkdown } from './lib/shared.js';

const WA_URL = 'https://web.whatsapp.com/*';
export const CONSENT_VERSION = 1;

// ---------- consent ----------
// Nothing is injected into WhatsApp Web and nothing is read until the user explicitly agrees
// on the welcome page. The scripts are registered only after consent and removed on revoke.
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
  const existing = (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id);
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing });
}

async function reloadWaTabs() {
  for (const t of await chrome.tabs.query({ url: WA_URL })) chrome.tabs.reload(t.id).catch(() => {});
}

async function grantConsent() {
  await chrome.storage.local.set({ consent: { version: CONSENT_VERSION, at: Date.now() } });
  await registerScripts();
  await scheduleAlarms();
  await reloadWaTabs();
}

async function revokeConsent() {
  await unregisterScripts();
  await chrome.alarms.clearAll();
  await clearAll();
  await chrome.storage.local.remove(['consent', 'status']);
  await reloadWaTabs();
}

// ---------- status ----------
async function setStatus(patch) {
  const { status } = await chrome.storage.local.get('status');
  const next = { ...(status || {}), ...patch };
  await chrome.storage.local.set({ status: next });
  return next;
}

async function filterIncoming(msgs, s) {
  const excluded = excludeMatcher(s.excludeChats);
  return msgs.filter((m) => !excluded(m)
    && !(m.isGroup && !s.includeGroups)
    && !(m.archived && !s.includeArchived)
    && !(m.muted && s.skipMuted));
}

async function ingest(msgs) {
  if (!(await hasConsent())) return 0;
  const s = await getSettings();
  const clean = await filterIncoming(msgs, s);
  const fresh = await putMessages(clean);
  if (fresh.length && s.webhookUrl) pushWebhook(fresh, s).catch(() => {});
  return fresh.length;
}

// ---------- optional webhook (off unless a URL is set) ----------
async function pushWebhook(messages, s) {
  const granted = await chrome.permissions.contains({ origins: [new URL(s.webhookUrl).origin + '/*'] });
  if (!granted) { await setStatus({ webhookError: 'אין הרשאה לכתובת ה-webhook' }); return; }
  const headers = { 'Content-Type': 'application/json' };
  if (s.webhookSecret) headers['X-WA-Reader-Secret'] = s.webhookSecret;
  for (let i = 0; i < messages.length; i += 200) {
    const res = await fetch(s.webhookUrl, { method: 'POST', headers, body: JSON.stringify({ source: 'wa-reader', messages: messages.slice(i, i + 200) }) });
    if (!res.ok) { await setStatus({ webhookError: `HTTP ${res.status}` }); return; }
  }
  await setStatus({ webhookError: '', webhookAt: Date.now() });
}

// ---------- sync ----------
async function findWaTab() {
  const tabs = await chrome.tabs.query({ url: WA_URL });
  return tabs[0] || null;
}

let syncing = false;
async function sync(reason = 'alarm') {
  if (!(await hasConsent())) return { ok: false, error: 'התוסף עוד לא הופעל – פתח את מסך ההפעלה' };
  if (syncing) return { ok: false, error: 'כבר מסנכרן' };
  syncing = true;
  try {
    const tab = await findWaTab();
    if (!tab) { await setStatus({ connected: false, lastError: 'WhatsApp Web לא פתוח' }); return { ok: false, error: 'פתח את web.whatsapp.com בכרום' }; }
    const s = await getSettings();
    const { status } = await chrome.storage.local.get('status');
    // first run: from yesterday 00:00. Later: from the last sync with a 10-minute overlap.
    const since = status?.lastSyncAt ? status.lastSyncAt - 10 * 60 * 1000 : startOfDay() - 86400000;
    const startedAt = Date.now();
    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, {
        kind: 'collect', since,
        opts: { includeGroups: s.includeGroups, includeArchived: s.includeArchived, includeChannels: s.includeChannels, perChat: s.perChat, maxChats: s.maxChats }
      });
    } catch (e) {
      await setStatus({ connected: false, lastError: 'הטאב של ווצאפ לא מגיב – רענן אותו' });
      return { ok: false, error: 'רענן את טאב הווצאפ' };
    }
    if (!res?.ok) { await setStatus({ lastError: res?.error || 'שגיאה לא ידועה' }); return { ok: false, error: res?.error }; }
    const added = await ingest(res.messages || []);
    await setStatus({ connected: true, lastSyncAt: startedAt, lastError: '', lastAdded: added, lastScanned: res.chatsScanned, lastReason: reason });
    return { ok: true, added, scanned: res.chatsScanned };
  } finally {
    syncing = false;
  }
}

// ---------- daily export to Downloads ----------
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function exportDay(dayMs = Date.now()) {
  const s = await getSettings();
  const from = startOfDay(new Date(dayMs));
  const to = from + 86400000;
  const msgs = await getRange(from, to);
  const md = toMarkdown(msgs, { fromMs: from, toMs: to, withPrompt: false });
  const folder = (s.exportFolder || 'WhatsApp-Digest').replace(/[^\w\-א-ת ]/g, '').trim() || 'WhatsApp-Digest';
  await chrome.downloads.download({
    url: 'data:text/markdown;charset=utf-8;base64,' + toBase64('﻿' + md),
    filename: `${folder}/whatsapp-${ymd(from)}.md`,
    conflictAction: 'overwrite',
    saveAs: false
  });
  await setStatus({ lastExportAt: Date.now() });
  return msgs.length;
}

// ---------- alarms ----------
function nextAt(hhmm) {
  const [h, m] = (hhmm || '23:30').split(':').map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

async function scheduleAlarms() {
  await chrome.alarms.clearAll();
  if (!(await hasConsent())) return;
  const s = await getSettings();
  chrome.alarms.create('sync', { periodInMinutes: Math.max(5, Number(s.syncEveryMin) || 30), delayInMinutes: 1 });
  chrome.alarms.create('prune', { periodInMinutes: 24 * 60, delayInMinutes: 5 });
  if (s.autoExport) chrome.alarms.create('export', { when: nextAt(s.exportTime), periodInMinutes: 24 * 60 });
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'sync') sync('alarm');
  else if (a.name === 'prune') {
    const s = await getSettings();
    await pruneOlderThan(Date.now() - (Number(s.retentionDays) || 14) * 86400000);
  } else if (a.name === 'export') {
    await sync('export').catch(() => {});
    await exportDay();
  }
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (await hasConsent()) { await registerScripts(); await scheduleAlarms(); }
  else {
    await unregisterScripts();
    if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
  }
});
chrome.runtime.onStartup.addListener(scheduleAlarms);
chrome.storage.onChanged.addListener((ch) => { if (ch.settings) scheduleAlarms(); });

// ---------- messages ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // Messages from the WhatsApp tab are only accepted from our own content script on web.whatsapp.com;
    // UI commands are only accepted from the extension's own pages.
    const fromWa = sender.tab && sender.url?.startsWith('https://web.whatsapp.com/') && sender.id === chrome.runtime.id;
    const fromUi = !sender.tab || sender.url?.startsWith(chrome.runtime.getURL(''));
    if (msg?.kind?.startsWith('wa_') ? !fromWa : !fromUi) return { ok: false, error: 'forbidden' };
    switch (msg?.kind) {
      case 'consent':
        await grantConsent();
        return { ok: true };
      case 'revoke':
        await revokeConsent();
        return { ok: true };
      case 'wa_ready':
        await setStatus({ connected: true, readyAt: Date.now(), waHidden: !!msg.payload?.lock?.hidden, readFns: msg.payload?.lock?.readFns ?? 0, me: msg.payload?.me || '', waJs: msg.payload?.version || '', lastError: '' });
        setTimeout(() => sync('ready'), 4000);
        return { ok: true };
      case 'wa_message':
        await ingest([msg.payload]);
        return { ok: true };
      case 'wa_error':
        await setStatus({ connected: false, lastError: msg.payload?.error || 'WA-JS error' });
        return { ok: true };
      case 'syncNow':
        return sync('manual');
      case 'getRange': {
        const s = await getSettings();
        const excluded = excludeMatcher(s.excludeChats);
        const rows = (await getRange(msg.from, msg.to)).filter((m) => !excluded(m));
        return { ok: true, messages: rows };
      }
      case 'exportNow':
        return { ok: true, count: await exportDay(msg.day || Date.now()) };
      case 'stats': {
        const { status } = await chrome.storage.local.get('status');
        const today = await getRange(startOfDay(), Date.now() + 60000);
        return { ok: true, consent: await hasConsent(), status: status || {}, total: await count(), today: today.length, tabOpen: !!(await findWaTab()) };
      }
      case 'wipe':
        await clearAll();
        await chrome.storage.local.remove('status');
        return { ok: true };
      default:
        return { ok: false, error: 'unknown' };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
