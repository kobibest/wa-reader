import { byline } from './byline.js';

const $ = (id) => document.getElementById(id);
let first = true;

function toast(t) { const x = $('toast'); x.textContent = t; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 1600); }

async function load() {
  const r = await chrome.runtime.sendMessage({ kind: 'state' }).catch(() => null);
  if (!r?.ok) return;
  const s = r.status;
  const wa = s.waOpen && s.waReady, bridge = s.bridge === 'connected';
  $('notActive').style.display = r.consent ? 'none' : 'block';
  $('d1').classList.toggle('on', r.consent && wa);
  $('d2').classList.toggle('on', r.consent && bridge);
  $('d3').classList.toggle('on', r.consent && wa && bridge);
  if (first) {
    first = false;
    const { settings } = await chrome.storage.local.get('settings');
    $('excludeChats').value = settings?.excludeChats || '';
  }
}

$('saveEx').onclick = async () => {
  await chrome.storage.local.set({ settings: { excludeChats: $('excludeChats').value } });
  toast('נשמר');
};
$('revoke').onclick = async () => {
  if (!confirm('לכבות את התוסף? הוא יתנתק מ-WhatsApp Web ומ-Claude Desktop.')) return;
  await chrome.runtime.sendMessage({ kind: 'revoke' });
  await load(); toast('התוסף כובה');
};

$('by').append(byline('options', { cta: 'צריכים אוטומציה לעסק? לשיחה ←' }));
load();
setInterval(load, 3000);
