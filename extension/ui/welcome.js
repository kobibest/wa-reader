import { byline } from './byline.js';

const $ = (id) => document.getElementById(id);
const showDone = () => { $('ask').style.display = 'none'; $('done').classList.add('show'); };

$('ok').onchange = () => { $('go').disabled = !$('ok').checked; };
$('go').onclick = async () => {
  $('go').disabled = true;
  const r = await chrome.runtime.sendMessage({ kind: 'consent' });
  if (r?.ok) showDone();
  else { $('go').disabled = false; $('go').textContent = 'שגיאה – נסה שוב'; }
};
$('toSetup').onclick = () => chrome.runtime.openOptionsPage();
$('by').append(byline('welcome'));

chrome.runtime.sendMessage({ kind: 'state' }).then((r) => { if (r?.consent) showDone(); });
