import { byline } from './byline.js';

const $ = (id) => document.getElementById(id);
const light = (n, on, note) => { $('d' + n).classList.toggle('on', on); $('k' + n).textContent = note; };

async function refresh() {
  const r = await chrome.runtime.sendMessage({ kind: 'state' }).catch(() => null);
  if (!r?.ok) return;
  $('setup').style.display = r.consent ? 'none' : 'block';
  $('main').style.display = r.consent ? 'block' : 'none';
  if (!r.consent) return;
  const s = r.status;
  const wa = s.waOpen && s.waReady;
  const bridge = s.bridge === 'connected';
  light(1, wa, wa ? `${s.chats} שיחות` : s.waOpen ? 'נטען…' : 'לא פתוח');
  light(2, bridge, bridge ? 'מחובר' : s.bridge === 'connecting' ? 'מתחבר…' : 'לא מחובר');
  light(3, wa && bridge, wa && bridge ? 'Claude יכול לקרוא' : '');
  $('hint').textContent = !s.waOpen ? 'פתח את web.whatsapp.com בכרום.'
    : !bridge ? 'פתח את Claude Desktop ובדוק שההרחבה WA Reader מותקנת ומופעלת (Settings ← Desktop app ← Extensions).'
    : '';
}

$('activate').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
$('opts').onclick = () => chrome.runtime.openOptionsPage();
$('openWa').onclick = () => chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
$('by').append(byline('popup', { compact: true }));
refresh();
setInterval(refresh, 2000);
