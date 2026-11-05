// Isolated-world content script on web.whatsapp.com: relays queries from the service worker to the page script.
(() => {
  const SRC_PAGE = 'WA_READER_PAGE';
  const SRC_EXT = 'WA_READER_EXT';
  const pending = new Map();
  let seq = 0;

  const toWorker = (msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* extension reloaded */ } };

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.data?.source !== SRC_PAGE) return;
    const { type, payload } = ev.data;
    if (type === 'query_result') {
      const p = pending.get(payload?.reqId);
      if (p) { pending.delete(payload.reqId); p(payload); }
    } else if (type === 'ready') toWorker({ kind: 'wa_ready', payload });
    else if (type === 'error') toWorker({ kind: 'wa_error', payload });
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.kind !== 'query') return;
    const reqId = ++seq;
    const timer = setTimeout(() => { pending.delete(reqId); sendResponse({ ok: false, error: 'WhatsApp Web did not answer in time' }); }, msg.timeoutMs || 110000);
    pending.set(reqId, (res) => { clearTimeout(timer); sendResponse(res); });
    window.postMessage({ source: SRC_EXT, type: 'query', reqId, method: msg.method, params: msg.params }, location.origin);
    return true;
  });
})();
