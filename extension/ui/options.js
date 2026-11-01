import { DEFAULTS, getSettings } from '../lib/shared.js';

const $ = (id) => document.getElementById(id);
const keys = Object.keys(DEFAULTS);
const say = (t) => { $('msg').textContent = t; setTimeout(() => ($('msg').textContent = ''), 3000); };

async function load() {
  const s = await getSettings();
  for (const k of keys) {
    const e = $(k); if (!e) continue;
    if (e.type === 'checkbox') e.checked = !!s[k]; else e.value = s[k];
  }
}

$('save').onclick = async () => {
  const s = {};
  for (const k of keys) {
    const e = $(k); if (!e) continue;
    s[k] = e.type === 'checkbox' ? e.checked : e.type === 'number' ? Number(e.value) || DEFAULTS[k] : e.value.trim();
  }
  if (s.webhookUrl) {
    let origin;
    try { origin = new URL(s.webhookUrl).origin; } catch { return say('כתובת webhook לא תקינה'); }
    // Must be called from the click – Chrome shows its own permission prompt.
    const ok = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!ok) return say('בלי הרשאה לכתובת הזו ה-webhook לא יעבוד');
  }
  await chrome.storage.local.set({ settings: s });
  say('נשמר');
};

$('exportNow').onclick = async () => {
  const r = await chrome.runtime.sendMessage({ kind: 'exportNow' });
  say(r?.ok ? `יוצאו ${r.count} הודעות ל-Downloads` : (r?.error || 'שגיאה'));
};

$('wipe').onclick = async () => {
  if (!confirm('למחוק את כל ההודעות ששמורות בתוסף? (ווצאפ עצמו לא מושפע)')) return;
  await chrome.runtime.sendMessage({ kind: 'wipe' });
  say('נמחק');
};

$('revoke').onclick = async () => {
  if (!confirm('לכבות את התוסף ולמחוק את כל ההודעות השמורות?')) return;
  await chrome.runtime.sendMessage({ kind: 'revoke' });
  say('התוסף כובה והנתונים נמחקו');
};

load();
