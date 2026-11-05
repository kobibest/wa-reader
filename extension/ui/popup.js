import { byline } from './byline.js';

const $ = (id) => document.getElementById(id);
const dot = (on) => `<span class="dot ${on ? 'on' : ''}"></span>`;

function ago(ms) {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60000);
  return min < 1 ? 'עכשיו' : min < 60 ? `לפני ${min} דק׳` : `לפני ${Math.round(min / 60)} שע׳`;
}

async function refresh() {
  const r = await chrome.runtime.sendMessage({ kind: 'state' });
  if (!r?.ok) return;
  $('setup').style.display = r.consent ? 'none' : 'block';
  $('main').style.display = r.consent ? 'block' : 'none';
  if (!r.consent) return;
  const s = r.status;
  $('wa').innerHTML = dot(s.waReady) + (s.waReady ? `מחובר · ${s.chats} שיחות` : s.waOpen ? 'הטאב פתוח, ממתין שייטען…' : 'לא פתוח בכרום');
  $('ai').innerHTML = dot(s.ai === 'connected') + (s.ai === 'connected' ? 'מחובר' : s.aiError ? s.aiError : 'ממתין לכלי AI (עוד לא הוגדר, או שהכלי סגור)');
  $('last').textContent = s.lastQueryAt ? `בקשה אחרונה מה-AI: ${ago(s.lastQueryAt)}` : '';
}

$('activate').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
$('opts').onclick = () => chrome.runtime.openOptionsPage();
$('openWa').onclick = () => chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
$('by').append(byline('popup', { compact: true }));
refresh();
setInterval(refresh, 3000);
