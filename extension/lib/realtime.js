// Minimal Supabase Realtime (Phoenix protocol) broadcast client over a plain WebSocket.
// Used by the extension's service worker and by the Supabase Edge Function. Broadcast messages are
// not persisted by Realtime; and everything WA Reader sends through it is encrypted (relay-crypto.js).
export class BroadcastChannel {
  constructor({ url, apikey, topic, onBroadcast = () => {}, onClose = () => {} }) {
    this.url = `${url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(apikey)}&vsn=1.0.0`;
    this.apikey = apikey;
    this.topic = `realtime:${topic}`;
    this.onBroadcast = onBroadcast;
    this.onClose = onClose;
    this.ref = 0;
    this.joinRef = null;
    this.ws = null;
    this.hb = null;
    this.joined = false;
  }

  #send(obj) { this.ws?.send(JSON.stringify(obj)); }

  join(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (e) => { if (!done) { done = true; reject(e); } };
      const timer = setTimeout(() => { fail(new Error('realtime join timeout')); this.close(); }, timeoutMs);
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.joinRef = String(++this.ref);
        const payload = { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } };
        if (this.apikey.split('.').length === 3) payload.access_token = this.apikey; // legacy JWT key
        this.#send({ topic: this.topic, event: 'phx_join', payload, ref: this.joinRef, join_ref: this.joinRef });
        this.hb = setInterval(() => this.#send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++this.ref) }), 25000);
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data)); } catch { return; }
        if (m.event === 'phx_reply' && m.ref === this.joinRef && m.topic === this.topic) {
          if (m.payload?.status === 'ok') { this.joined = true; clearTimeout(timer); if (!done) { done = true; resolve(); } }
          else fail(new Error('realtime join refused: ' + JSON.stringify(m.payload?.response || m.payload).slice(0, 200)));
        } else if (m.event === 'broadcast' && m.topic === this.topic && m.payload) {
          try { this.onBroadcast(m.payload.event, m.payload.payload || {}); } catch { /* ignore */ }
        } else if ((m.event === 'phx_error' || m.event === 'phx_close') && m.topic === this.topic) {
          this.close();
        }
      };
      ws.onclose = () => { clearInterval(this.hb); this.joined = false; clearTimeout(timer); fail(new Error('realtime closed')); this.onClose(); };
      ws.onerror = () => { /* onclose follows */ };
    });
  }

  broadcast(event, payload) {
    if (!this.joined) throw new Error('not joined');
    this.#send({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: String(++this.ref), join_ref: this.joinRef });
  }

  close() { clearInterval(this.hb); this.joined = false; try { this.ws?.close(); } catch { /* ignore */ } this.ws = null; }
}
