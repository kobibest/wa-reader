// WA Reader – page script (MAIN world, next to WA-JS).
// READ-ONLY by design:
//   1. On ready it captures only read functions (chat.list/get/getMessages, contact.get, on) into a frozen object R.
//   2. Then it deletes the global WPP from the page, so no code on web.whatsapp.com can reach any send/mark/delete API.
(() => {
  'use strict';
  const SRC_PAGE = 'WA_READER_PAGE';
  const SRC_EXT = 'WA_READER_EXT';
  const post = (type, payload) => window.postMessage({ source: SRC_PAGE, type, payload }, location.origin);

  const widStr = (w) => {
    if (!w) return '';
    if (typeof w === 'string') return w;
    if (w._serialized) return w._serialized;
    if (w.user && w.server) return `${w.user}@${w.server}`;
    try { return String(w); } catch { return ''; }
  };

  // ---------- 1. Lockdown ----------
  // R holds the ONLY WA-JS functions this extension can use. After capture, the global WPP object is
  // removed from the page, so no script on web.whatsapp.com (ours or anyone's) can reach send/mark/delete.
  let R = null;
  const MUTATING = /^(send|mark|delete|edit|forward|archive|unarchive|pin|unpin|mute|unmute|clear|star|keep|set|open|close|create|add|remove|leave|join|promote|demote|report|save|subscribe|unsubscribe|update|block|unblock|post|reject|accept|revoke|approve|logout|refresh|change|gen|follow|unfollow|react|vote|request)/i;
  function lockdown() {
    const W = window.WPP;
    R = Object.freeze({
      list: W.chat.list.bind(W.chat),
      getChat: W.chat.get.bind(W.chat),
      getMessages: W.chat.getMessages.bind(W.chat),
      getContact: W.contact.get.bind(W.contact),
      on: W.on.bind(W),
      myId: () => { try { return W.conn.getMyUserId(); } catch { return null; } },
      version: W.version || ''
    });

    // Belt: try to stub mutating functions (WA-JS exports are getters, so this usually can't stick – that's fine).
    let blocked = 0;
    for (const ns of Object.keys(W)) {
      const obj = W[ns];
      if (!obj || typeof obj !== 'object' || ns === 'whatsapp' || ns === 'webpack' || ns === 'loader') continue;
      for (const k of Object.keys(obj)) {
        if (!MUTATING.test(k) || typeof obj[k] !== 'function') continue;
        try {
          Object.defineProperty(obj, k, { value: () => { throw new Error(`WA Reader: read-only, ${ns}.${k} is blocked`); }, writable: false, configurable: false });
          blocked++;
        } catch { /* getter export – covered by hiding below */ }
      }
    }

    // Braces: remove the global entirely.
    try { delete window.WPP; } catch { /* ignore */ }
    if (window.WPP) {
      try { Object.defineProperty(window, 'WPP', { value: undefined, writable: false, configurable: false }); } catch { /* ignore */ }
    }
    return { hidden: !window.WPP, blocked, readFns: Object.keys(R).length - 1 };
  }

  // ---------- 2. Serialization ----------
  const SKIP_TYPES = new Set([
    'e2e_notification', 'notification', 'notification_template', 'gp2', 'protocol',
    'ciphertext', 'call_log', 'reaction', 'pinned_message', 'keep_in_chat', 'debug', 'unknown'
  ]);
  const MEDIA_LABEL = {
    image: 'תמונה', video: 'וידאו', ptt: 'הודעה קולית', audio: 'אודיו', document: 'מסמך',
    sticker: 'סטיקר', location: 'מיקום', vcard: 'איש קשר', multi_vcard: 'אנשי קשר',
    poll_creation: 'סקר', revoked: 'הודעה נמחקה', ptv: 'וידאו עגול', gif: 'GIF', event_creation: 'אירוע'
  };

  const nameCache = new Map();
  async function contactName(wid) {
    const id = widStr(wid);
    if (!id) return '';
    if (nameCache.has(id)) return nameCache.get(id);
    let n = '';
    try {
      const c = await R.getContact(id);
      n = c?.name || c?.formattedName || c?.pushname || c?.verifiedName || '';
    } catch { /* ignore */ }
    nameCache.set(id, n);
    return n;
  }

  function chatMeta(c) {
    const id = widStr(c.id);
    return {
      id,
      name: c.formattedTitle || c.name || c.contact?.name || c.contact?.formattedName || c.contact?.pushname || id.split('@')[0],
      isGroup: !!c.isGroup || id.endsWith('@g.us'),
      archived: !!c.archive,
      muted: !!(c.mute?.isMuted || (c.muteExpiration && c.muteExpiration !== 0))
    };
  }

  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

  async function serialize(m, meta) {
    const type = m.type || 'unknown';
    if (SKIP_TYPES.has(type) || m.isNotification) return null;
    const key = m.id || {};
    const id = widStr(key) || key.id;
    if (!id) return null;
    const fromMe = !!(key.fromMe ?? m.fromMe);

    // NOTE: for media, m.body holds a base64 thumbnail – never use it as text.
    let text = type === 'chat' ? (m.body || '') : (m.caption || '');
    if (type !== 'chat') {
      let label = MEDIA_LABEL[type] || type;
      if (type === 'document' && m.filename) label += `: ${m.filename}`;
      if (type === 'poll_creation' && m.pollName) label += `: ${m.pollName}`;
      if (type === 'location' && (m.loc || m.comment)) label += `: ${m.loc || m.comment}`;
      text = `[${label}]` + (text ? ` ${text}` : '');
    }

    let sender;
    if (fromMe) sender = 'אני';
    else if (meta.isGroup) {
      const authorId = widStr(m.author);
      sender = (await contactName(authorId)) || m.notifyName || authorId.split('@')[0] || '?';
    } else sender = meta.name;

    let quoted = '';
    const q = m.quotedMsg;
    if (q) quoted = q.type === 'chat' ? clip(q.body, 140) : (q.caption ? clip(q.caption, 140) : `[${MEDIA_LABEL[q.type] || q.type || 'הודעה'}]`);

    return {
      id,
      chatId: meta.id,
      chatName: meta.name,
      isGroup: meta.isGroup,
      archived: meta.archived,
      muted: meta.muted,
      fromMe,
      sender,
      t: m.t || 0,
      type,
      text,
      quoted,
      forwarded: !!m.isForwarded
    };
  }

  // ---------- 3. Collect ----------
  async function collect({ since, opts = {} }) {
    const sinceSec = Math.floor(since / 1000);
    const chats = await R.list({ count: opts.maxChats || 300 });
    const out = [];
    let scanned = 0;
    for (const c of chats) {
      const meta = chatMeta(c);
      if (meta.id === 'status@broadcast') continue;
      if (meta.id.endsWith('@newsletter') && !opts.includeChannels) continue;
      if (meta.archived && !opts.includeArchived) continue;
      if (meta.isGroup && opts.includeGroups === false) continue;
      if (c.t && c.t < sinceSec) continue; // no activity in the window
      scanned++;
      let msgs = [];
      try {
        msgs = await R.getMessages(meta.id, { count: opts.perChat || 200 });
      } catch (e) {
        continue;
      }
      for (const m of msgs) {
        if ((m.t || 0) < sinceSec) continue;
        const s = await serialize(m, meta);
        if (s) out.push(s);
      }
      if (scanned % 10 === 0) await new Promise((r) => setTimeout(r, 25)); // keep the UI responsive
    }
    return { messages: out, chatsScanned: scanned };
  }

  // ---------- 4. Wiring ----------
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || ev.data?.source !== SRC_EXT) return;
    const { type, reqId, payload } = ev.data;
    if (type === 'collect') {
      if (!R) return post('collect_result', { reqId, ok: false, error: 'WhatsApp עדיין נטען' });
      try {
        const res = await collect(payload || {});
        post('collect_result', { reqId, ok: true, ...res });
      } catch (e) {
        post('collect_result', { reqId, ok: false, error: String(e?.message || e) });
      }
    } else if (type === 'ping') {
      post('pong', { reqId, ready: !!R });
    }
  });

  function start() {
    const lock = lockdown();
    let me = '';
    me = widStr(R.myId());
    post('ready', { lock, me, version: R.version });

    R.on('chat.new_message', async (msg) => {
      try {
        const remote = widStr(msg.id?.remote) || widStr(msg.from);
        if (!remote || remote === 'status@broadcast') return;
        const chat = R.getChat(remote);
        const meta = chat ? chatMeta(chat) : { id: remote, name: remote.split('@')[0], isGroup: remote.endsWith('@g.us'), archived: false, muted: false };
        const s = await serialize(msg, meta);
        if (s) post('new_message', s);
      } catch { /* ignore */ }
    });
  }

  const W = window.WPP;
  if (!W) {
    post('error', { error: 'WA-JS did not load' });
    return;
  }
  if (W.isFullReady) start();
  else W.loader.onFullReady(start);
})();
