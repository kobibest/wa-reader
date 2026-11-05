import { byline } from './byline.js';

const $ = (id) => document.getElementById(id);
const PKG = 'github:kobibest/wa-reader';
const isWin = /Win/i.test(navigator.userAgentData?.platform || navigator.platform || '');
let state = null;
let tab = 'desktop';

function toast(t) { const x = $('toast'); x.textContent = t; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 1600); }

function serverEntry(s) {
  const env = { WA_READER_TOKEN: s.token };
  if (Number(s.port) && Number(s.port) !== 47821) env.WA_READER_PORT = String(s.port);
  return isWin
    ? { command: 'cmd', args: ['/c', 'npx', '-y', PKG], env }
    : { command: 'npx', args: ['-y', PKG], env };
}

function renderConfig() {
  if (!state) return;
  const s = state.settings;
  $('paneDesktop').style.display = tab === 'desktop' ? 'block' : 'none';
  $('paneAdvanced').style.display = tab === 'desktop' ? 'none' : 'block';
  $('tokFull').textContent = s.token;
  $('connUrl').textContent = state.connectorUrl;
  $('connKey').textContent = state.connectorKey;
  const entry = serverEntry(s);
  let how = '', cfg = '';
  if (tab === 'desktop') {
    how = 'ב-Claude לדסקטופ: Settings ← Developer ← Edit Config. פותחים את הקובץ <code>claude_desktop_config.json</code> ומדביקים. אם כבר יש בקובץ <code>mcpServers</code>, מוסיפים רק את הבלוק <code>"whatsapp"</code>.';
    cfg = JSON.stringify({ mcpServers: { whatsapp: entry } }, null, 2);
  } else if (tab === 'cursor') {
    how = 'ב-Cursor: Settings ← MCP ← Add new MCP server, או מדביקים בקובץ <code>~/.cursor/mcp.json</code>.';
    cfg = JSON.stringify({ mcpServers: { whatsapp: entry } }, null, 2);
  } else if (tab === 'code') {
    how = 'מריצים בטרמינל פעם אחת:';
    const envArgs = Object.entries(entry.env).map(([k, v]) => `-e ${k}=${v}`).join(' ');
    cfg = `claude mcp add whatsapp --scope user ${envArgs} -- ${entry.command} ${entry.args.join(' ')}`;
  } else {
    how = 'כל כלי שתומך ב-MCP מקומי (stdio): פקודה, ארגומנטים ומשתני סביבה:';
    cfg = `command: ${entry.command}\nargs:    ${entry.args.join(' ')}\n` + Object.entries(entry.env).map(([k, v]) => `env:     ${k}=${v}`).join('\n');
  }
  $('howto').innerHTML = how;
  $('cfg').textContent = cfg;
}

async function load() {
  const r = await chrome.runtime.sendMessage({ kind: 'state' });
  if (!r?.ok) return;
  const first = !state;
  state = r;
  const s = r.status;
  $('notActive').style.display = r.consent ? 'none' : 'block';
  $('wa').innerHTML = `<span class="dot ${s.waReady ? 'on' : ''}"></span>WhatsApp Web: ` + (s.waReady ? `מחובר (${s.chats} שיחות)` : s.waOpen ? 'נטען…' : 'לא פתוח');
  $('ai').innerHTML = `<span class="dot ${s.cloud === 'connected' ? 'on' : ''}"></span>חיבור ל-Claude: ` + (s.cloud === 'connected' ? 'מוכן' : s.waOpen ? 'מתחבר…' : 'ממתין ל-WhatsApp Web') +
    (s.ai === 'connected' ? ' · <span class="dot on"></span>חיבור מקומי: מחובר' : '');
  if (first) {
    $('excludeChats').value = r.settings.excludeChats || '';
    $('port').value = r.settings.port;
  }
  $('tok').textContent = r.settings.token.slice(0, 6) + '…' + r.settings.token.slice(-4);
  renderConfig();
}

async function saveSettings(patch) {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
  state = null; await load();
}

document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => {
  tab = b.dataset.t;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
  renderConfig();
}));
$('copyConn').onclick = async () => { await navigator.clipboard.writeText(state.connectorUrl); toast('הכתובת הועתקה'); };
$('copyHdr').onclick = async () => { await navigator.clipboard.writeText('x-api-key'); toast('שם הכותרת הועתק'); };
$('copyKey').onclick = async () => { await navigator.clipboard.writeText(state.connectorKey); toast('המפתח הועתק'); };
$('newConn').onclick = async () => {
  if (!confirm('ליצור מפתח חיבור חדש? המפתח הנוכחי יפסיק לעבוד, וצריך לעדכן אותו ב-Claude.')) return;
  await chrome.runtime.sendMessage({ kind: 'newCloudSecret' }); state = null; await load(); toast('נוצר מפתח חדש');
};
$('copyTok').onclick = async () => { await navigator.clipboard.writeText(state.settings.token); toast('הטוקן הועתק'); };
$('copyCfg').onclick = async () => { await navigator.clipboard.writeText($('cfg').textContent); toast('הועתק'); };
$('saveEx').onclick = async () => { await saveSettings({ excludeChats: $('excludeChats').value }); toast('נשמר'); };
$('savePort').onclick = async () => {
  const p = Number($('port').value);
  if (!(p >= 1024 && p <= 65535)) return toast('פורט לא תקין');
  await saveSettings({ port: p }); toast('נשמר – העתק שוב את ההגדרה');
};
$('newTok').onclick = async () => {
  if (!confirm('ליצור טוקן חדש? כלי AI שכבר הוגדרו יפסיקו לעבוד עד שתעתיק את ההגדרה מחדש.')) return;
  await chrome.runtime.sendMessage({ kind: 'newToken' }); state = null; await load(); toast('נוצר טוקן חדש');
};
$('revoke').onclick = async () => {
  if (!confirm('לכבות את התוסף? הוא יתנתק מ-WhatsApp Web ומכלי ה-AI.')) return;
  await chrome.runtime.sendMessage({ kind: 'revoke' }); state = null; await load(); toast('התוסף כובה');
};

$('by').append(byline('options', { cta: 'צריכים אוטומציה לעסק? לשיחה ←' }));
load();
setInterval(load, 4000);
