// WA Reader – page script (MAIN world, next to WA-JS). Answers read-only queries on demand.
// READ-ONLY by design:
//   1. On ready it captures only read functions (chat.list/get/getMessages, contact.get) into a frozen object R.
//   2. Then it deletes the global WPP from the page, so no code on web.whatsapp.com can reach any send/mark/delete API.
// Nothing is stored here; each query reads live from WhatsApp Web's own memory.
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
  let R = null;
  const MUTATING = /^(send|mark|delete|edit|forward|archive|unarchive|pin|unpin|mute|unmute|clear|star|keep|set|open|close|create|add|remove|leave|join|promote|demote|report|save|subscribe|unsubscribe|update|block|unblock|post|reject|accept|revoke|approve|logout|refresh|change|gen|follow|unfollow|react|vote|request)/i;
  function lockdown() {
    const W = window.WPP;
    R = Object.freeze({
      list: W.chat.list.bind(W.chat),
      getChat: W.chat.get.bind(W.chat),
      getMessages: W.chat.getMessages.bind(W.chat),
      getContact: W.contact.get.bind(W.contact),
      myId: () => { try { return W.conn.getMyUserId(); } catch { return null; } },
      version: W.version || ''
    });
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
    try { delete window.WPP; } catch { /* ignore */ }
    if (window.WPP) {
      try { Object.defineProperty(window, 'WPP', { value: undefined, writable: false, configurable: false }); } catch { /* ignore */ }
    }
    return { hidden: !window.WPP, blocked };
  }

  // ---------- 2. Serialization ----------
  const SKIP_TYPES = new Set([
    'e2e_notification', 'notification', 'notification_template', 'gp2', 'protocol',
    'ciphertext', 'call_log', 'reaction', 'pinned_message', 'keep_in_chat', 'debug', 'unknown'
  ]);
  const MEDIA_LABEL = {
    image: 'image', video: 'video', ptt: 'voice message', audio: 'audio', document: 'document',
    sticker: 'sticker', location: 'location', vcard: 'contact card', multi_vcard: 'contact cards',
    poll_creation: 'poll', revoked: 'deleted message', ptv: 'video note', gif: 'GIF', event_creation: 'event'
  };
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

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
      muted: !!(c.mute?.isMuted || (c.muteExpiration && c.muteExpiration !== 0)),
      unread: Math.max(0, Number(c.unreadCount) || 0),
      t: c.t || 0
    };
  }

  async function serialize(m, meta) {
    const type = m.type || 'unknown';
    if (SKIP_TYPES.has(type) || m.isNotification) return null;
    const key = m.id || {};
    const id = widStr(key) || key.id;
    if (!id) return null;
    const fromMe = !!(key.fromMe ?? m.fromMe);
    // for media, m.body holds a base64 thumbnail – never use it as text
    let text = type === 'chat' ? (m.body || '') : (m.caption || '');
    if (type !== 'chat') {
      let label = MEDIA_LABEL[type] || type;
      if (type === 'document' && m.filename) label += `: ${m.filename}`;
      if (type === 'poll_creation' && m.pollName) label += `: ${m.pollName}`;
      if (type === 'location' && (m.loc || m.comment)) label += `: ${m.loc || m.comment}`;
      text = `[${label}]` + (text ? ` ${text}` : '');
    }
    let sender;
    if (fromMe) sender = 'Me';
    else if (meta.isGroup) {
      const authorId = widStr(m.author);
      sender = (await contactName(authorId)) || m.notifyName || authorId.split('@')[0] || '?';
    } else sender = meta.name;
    let quoted = '';
    const q = m.quotedMsg;
    if (q) quoted = q.type === 'chat' ? clip(q.body, 140) : (q.caption ? clip(q.caption, 140) : `[${MEDIA_LABEL[q.type] || q.type || 'message'}]`);
    return { id, chatId: meta.id, chatName: meta.name, fromMe, sender, t: m.t || 0, type, text: clip(text, 4000), quoted, forwarded: !!m.isForwarded };
  }

  // ---------- 3. Queries ----------
  function excluder(list) {
    const xs = (list || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    return (meta) => {
      const n = (meta.name || '').toLowerCase(), id = (meta.id || '').toLowerCase();
      return xs.some((x) => n === x || id === x || id.split('@')[0] === x);
    };
  }

  async function allChats(includeArchived, excluded) {
    const chats = await R.list({ count: 2000 });
    return chats.map((c) => ({ c, meta: chatMeta(c) }))
      .filter(({ meta }) => meta.id !== 'status@broadcast' && !meta.id.endsWith('@newsletter') && !excluded(meta) && (includeArchived || !meta.archived))
      .sort((a, b) => b.meta.t - a.meta.t);
  }

  async function lastMessage(meta) {
    try {
      const msgs = await R.getMessages(meta.id, { count: 5 });
      for (let i = msgs.length - 1; i >= 0; i--) { const s = await serialize(msgs[i], meta); if (s) return s; }
    } catch { /* ignore */ }
    return null;
  }

  async function resolveChat(query, excluded) {
    const q = String(query || '').trim();
    const chats = await allChats(true, excluded);
    const byId = chats.find(({ meta }) => meta.id === q || meta.id.split('@')[0] === q.replace(/[^\d]/g, ''));
    if (byId) return { found: byId };
    const lq = q.toLowerCase();
    const exact = chats.filter(({ meta }) => meta.name.toLowerCase() === lq);
    if (exact.length === 1) return { found: exact[0] };
    const partial = exact.length ? exact : chats.filter(({ meta }) => meta.name.toLowerCase().includes(lq));
    if (partial.length === 1) return { found: partial[0] };
    if (partial.length > 1) return { candidates: partial.slice(0, 15).map(({ meta }) => ({ id: meta.id, name: meta.name })) };
    return {};
  }

  // "2026-11-05" or "2026-11-05T08:00" in the user's local time (the browser's timezone)
  function localTime(v) {
    if (typeof v === 'number') return v;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(v).trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }

  const publicChat = (meta, extra = {}) => ({ id: meta.id, name: meta.name, isGroup: meta.isGroup, archived: meta.archived, muted: meta.muted, unread: meta.unread, ...extra });

  const METHODS = {
    async status() {
      const chats = await R.list({ count: 2000 });
      return { whatsappReady: true, me: widStr(R.myId()).split('@')[0], chats: chats.length, waJs: R.version };
    },

    async listChats({ limit = 30, filter = 'all', includeArchived = false, exclude }) {
      const excluded = excluder(exclude);
      let chats = await allChats(includeArchived, excluded);
      if (filter === 'unread') chats = chats.filter(({ meta }) => meta.unread > 0);
      if (filter === 'direct' || filter === 'awaiting_reply') chats = chats.filter(({ meta }) => !meta.isGroup);
      if (filter === 'groups') chats = chats.filter(({ meta }) => meta.isGroup);
      const out = [];
      for (const { meta } of chats) {
        if (out.length >= limit) break;
        const last = await lastMessage(meta);
        if (filter === 'awaiting_reply' && (!last || last.fromMe)) continue;
        out.push(publicChat(meta, { lastTime: last?.t || meta.t, lastFromMe: !!last?.fromMe, lastSender: last?.sender || '', lastPreview: last?.text || '', awaitingReply: !!last && !last.fromMe && !meta.isGroup }));
      }
      return { chats: out };
    },

    async getMessages({ chat, limit = 50, since, until, exclude }) {
      const r = await resolveChat(chat, excluder(exclude));
      if (r.candidates) return { candidates: r.candidates };
      if (!r.found) return { chat: null };
      const { meta } = r.found;
      const sinceSec = since ? Math.floor(localTime(since) / 1000) || 0 : 0;
      const untilSec = until ? Math.floor(localTime(until) / 1000) || Infinity : Infinity;
      const fetchN = sinceSec ? Math.max(limit * 3, 300) : limit + 20;
      const raw = await R.getMessages(meta.id, { count: Math.min(fetchN, 2000) });
      const out = [];
      for (const m of raw) {
        const t = m.t || 0;
        if (t < sinceSec || t >= untilSec) continue;
        const s = await serialize(m, meta);
        if (s) out.push(s);
      }
      const last = out[out.length - 1];
      return { chat: publicChat(meta, { awaitingReply: !!last && !last.fromMe && !meta.isGroup }), messages: out.slice(-limit) };
    },

    async recent({ sinceMs, includeGroups = true, includeMuted = false, includeArchived = false, maxChats = 80, exclude }) {
      const sinceSec = Math.floor(sinceMs / 1000);
      const chats = (await allChats(includeArchived, excluder(exclude)))
        .filter(({ meta }) => meta.t >= sinceSec && (includeGroups || !meta.isGroup) && (includeMuted || !meta.muted));
      const out = [];
      let total = 0, truncated = false;
      for (const { meta } of chats) {
        if (out.length >= maxChats || total >= 3000) { truncated = true; break; }
        let raw = [];
        try { raw = await R.getMessages(meta.id, { count: 300 }); } catch { continue; }
        const msgs = [];
        for (const m of raw) {
          if ((m.t || 0) < sinceSec) continue;
          const s = await serialize(m, meta);
          if (s) msgs.push(s);
        }
        if (!msgs.length) continue;
        total += msgs.length;
        const last = msgs[msgs.length - 1];
        out.push({ ...publicChat(meta, { awaitingReply: !last.fromMe && !meta.isGroup }), messages: msgs });
      }
      return { chats: out, truncated };
    },

    async search({ query, sinceMs, chat, limit = 50, exclude }) {
      const excluded = excluder(exclude);
      const q = String(query || '').toLowerCase();
      const sinceSec = Math.floor(sinceMs / 1000);
      let targets;
      if (chat) {
        const r = await resolveChat(chat, excluded);
        if (r.candidates) return { candidates: r.candidates };
        targets = r.found ? [r.found] : [];
      } else {
        targets = (await allChats(true, excluded)).filter(({ meta }) => meta.t >= sinceSec).slice(0, 200);
      }
      const hits = [];
      for (const { meta } of targets) {
        let raw = [];
        try { raw = await R.getMessages(meta.id, { count: chat ? 2000 : 400 }); } catch { continue; }
        for (const m of raw) {
          if ((m.t || 0) < sinceSec) continue;
          const s = await serialize(m, meta);
          if (s && s.text.toLowerCase().includes(q)) hits.push(s);
        }
      }
      hits.sort((a, b) => b.t - a.t);
      return { hits: hits.slice(0, limit) };
    }
  };

  // ---------- 4. Wiring ----------
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || ev.data?.source !== SRC_EXT || ev.data.type !== 'query') return;
    const { reqId, method, params } = ev.data;
    if (!R) return post('query_result', { reqId, ok: false, error: 'WhatsApp Web is still loading. Try again in a few seconds.' });
    const fn = Object.prototype.hasOwnProperty.call(METHODS, method) ? METHODS[method] : null;
    if (!fn) return post('query_result', { reqId, ok: false, error: 'unknown method' });
    try { post('query_result', { reqId, ok: true, result: await fn(params || {}) }); }
    catch (e) { post('query_result', { reqId, ok: false, error: String(e?.message || e) }); }
  });

  function start() {
    const lock = lockdown();
    post('ready', { lock, me: widStr(R.myId()).split('@')[0], version: R.version });
  }

  const W = window.WPP;
  if (!W) { post('error', { error: 'WA-JS did not load' }); return; }
  if (W.isFullReady) start();
  else W.loader.onFullReady(start);
})();
