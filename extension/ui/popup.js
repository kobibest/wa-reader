const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);

function ago(ms) {
  if (!ms) return 'אף פעם';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  return h < 24 ? `לפני ${h} שע׳` : new Date(ms).toLocaleString('he-IL');
}

async function refresh() {
  const r = await send({ kind: 'stats' });
  if (!r?.ok) return;
  $('setup').style.display = r.consent ? 'none' : 'block';
  $('main').style.display = r.consent ? 'grid' : 'none';
  if (!r.consent) { $('conn').innerHTML = '<span class="dot"></span>לא פעיל'; return; }
  const s = r.status;
  const on = r.tabOpen && s.connected;
  $('conn').innerHTML = `<span class="dot ${on ? 'on' : ''}"></span>` +
    (on ? 'מחובר ל-WhatsApp Web' : r.tabOpen ? (s.lastError || 'ממתין שווצאפ ייטען…') : 'WhatsApp Web לא פתוח בכרום');
  $('today').textContent = r.today;
  $('total').textContent = r.total;
  $('last').textContent = `סנכרון אחרון: ${ago(s.lastSyncAt)}` + (s.lastAdded != null ? ` · ${s.lastAdded} חדשות` : '');
  $('lock').textContent = s.connected ? (s.waHidden ? 'נעילה פעילה: רק פונקציות קריאה זמינות, ממשק השליחה מנותק מהדף' : '⚠ הנעילה לא הושלמה – רענן את טאב הווצאפ') : '';
}

$('activate').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
$('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('ui/digest.html') });
$('opts').onclick = () => chrome.runtime.openOptionsPage();
$('sync').onclick = async () => {
  $('sync').disabled = true; $('msg').textContent = 'מסנכרן…';
  const r = await send({ kind: 'syncNow' });
  $('msg').textContent = r?.ok ? `נוספו ${r.added} הודעות מ-${r.scanned} שיחות` : (r?.error || 'שגיאה');
  $('sync').disabled = false;
  refresh();
};
refresh();
