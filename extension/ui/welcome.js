const $ = (id) => document.getElementById(id);

$('ok').onchange = () => { $('go').disabled = !$('ok').checked; };
$('go').onclick = async () => {
  $('go').disabled = true;
  const r = await chrome.runtime.sendMessage({ kind: 'consent' });
  if (r?.ok) {
    $('ask').style.display = 'none';
    $('done').classList.add('show');
  } else {
    $('go').disabled = false;
    $('go').textContent = 'שגיאה – נסה שוב';
  }
};

chrome.runtime.sendMessage({ kind: 'stats' }).then((r) => {
  if (r?.consent) { $('ask').style.display = 'none'; $('done').classList.add('show'); }
});
