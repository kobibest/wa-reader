// Isolated-world content script: relays between the page script and the service worker.
(() => {
  const SRC_PAGE = 'WA_READER_PAGE';
  const SRC_EXT = 'WA_READER_EXT';
  const pending = new Map();
  let seq = 0;

  const toWorker = (msg) => {
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* extension reloaded */ }
  };

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.data?.source !== SRC_PAGE) return;
    const { type, payload } = ev.data;
    if (type === 'collect_result' || type === 'pong') {
      const p = pending.get(payload?.reqId);
      if (p) { pending.delete(payload.reqId); p(payload); }
      return;
    }
    if (type === 'ready') toWorker({ kind: 'wa_ready', payload });
    else if (type === 'new_message') toWorker({ kind: 'wa_message', payload });
    else if (type === 'error') toWorker({ kind: 'wa_error', payload });
  });

  function ask(type, payload, timeoutMs) {
    return new Promise((resolve) => {
      const reqId = ++seq;
      const timer = setTimeout(() => { pending.delete(reqId); resolve({ ok: false, error: 'timeout' }); }, timeoutMs);
      pending.set(reqId, (res) => { clearTimeout(timer); resolve(res); });
      window.postMessage({ source: SRC_EXT, type, reqId, payload }, location.origin);
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.kind === 'collect') {
      ask('collect', { since: msg.since, opts: msg.opts }, 180000).then(sendResponse);
      return true;
    }
    if (msg?.kind === 'ping') {
      ask('ping', {}, 5000).then(sendResponse);
      return true;
    }
  });
})();
