// Runs only on the WA Reader consent page (kobibest.github.io/wa-reader/connect.html).
// When the user clicks "Approve" there, hands the page this install's personal connector key,
// so Claude's sign-in completes without copying anything. Nothing else is exposed.
(() => {
  const post = (m) => window.postMessage({ waReader: true, from: 'ext', ...m }, location.origin);
  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.waReader !== true || d.from !== 'page') return;
    if (d.type === 'hello') {
      const r = await chrome.runtime.sendMessage({ kind: 'connectInfo' }).catch(() => null);
      post({ type: 'here', activated: !!r?.consent, version: chrome.runtime.getManifest().version });
    } else if (d.type === 'getKey') {
      const r = await chrome.runtime.sendMessage({ kind: 'connectKey' }).catch(() => null);
      post({ type: 'key', ok: !!r?.ok, secret: r?.secret || null, error: r?.error || null });
    }
  });
  post({ type: 'here-early' });
})();
