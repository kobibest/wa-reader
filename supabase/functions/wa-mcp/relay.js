// Cloud relay: forwards one MCP tool call to the user's WA Reader extension over Supabase Realtime
// (encrypted end to end), waits for the answer, returns it. Nothing is written to a database, file or log.
import { BroadcastChannel } from './realtime.js';
import { deriveRelay, seal, open, randomId } from './relay-crypto.js';

export const EXT_OFFLINE =
  'WhatsApp is not reachable. Ask the user to: (1) open https://web.whatsapp.com in Chrome on their computer, ' +
  '(2) make sure the WA Reader extension is installed and activated, and (3) check that the x-api-key header of this ' +
  'connector matches the key shown in the extension settings (it changes if the user regenerates it).';

const REALTIME_URL = Deno.env.get('SUPABASE_URL') || 'https://igmqqdexoqwulvknvrnj.supabase.co';
// public anon key (same one the extension uses); only lets clients join Realtime broadcast channels
const REALTIME_KEY = Deno.env.get('SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbXFxZGV4b3F3dWx2a252cm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjExOTYsImV4cCI6MjEwMDE5NzE5Nn0.Pp0IgD6hVK64GL457ZxCBz60G1SrhqXgETrFEyEKi8Q';

export async function relayCall(secret, method, params, timeoutMs = 60000) {
  const { topic, key } = await deriveRelay(secret);
  const rid = randomId();
  const chunks = new Map();
  let total = 0;
  let acked = false;
  let finish;
  const done = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  done.catch(() => {}); // settled by whichever comes first; later rejections are expected and ignored

  const ch = new BroadcastChannel({
    url: REALTIME_URL, apikey: REALTIME_KEY, topic,
    onBroadcast: (event, p) => {
      if (p.rid !== rid) return;
      if (event === 'ack') acked = true;
      else if (event === 'res' && typeof p.d === 'string' && Number.isInteger(p.k) && Number.isInteger(p.n) && p.n > 0 && p.n <= 200) {
        total = p.n; chunks.set(p.k, p.d);
        if (chunks.size === total) {
          let sealed = '';
          for (let i = 0; i < total; i++) sealed += chunks.get(i) || '';
          open(key, sealed).then((msg) => (msg.rid === rid ? finish.resolve(msg) : finish.reject(new Error('bad response'))), () => finish.reject(new Error('bad response')));
        }
      }
    },
    onClose: () => finish.reject(new Error('relay closed'))
  });

  try {
    await ch.join();
    ch.broadcast('req', { rid, e: await seal(key, { rid, method, params: params || {}, ts: Date.now() }) });
    const ackTimer = setTimeout(() => { if (!acked) finish.reject(new Error(EXT_OFFLINE)); }, 6000);
    const allTimer = setTimeout(() => finish.reject(new Error('The WA Reader extension did not answer in time. Is the WhatsApp Web tab still open?')), timeoutMs);
    try {
      const msg = await done;
      if (!msg.ok) throw new Error(msg.error || 'extension error');
      return msg.result;
    } finally { clearTimeout(ackTimer); clearTimeout(allTimer); }
  } finally {
    ch.close();
    chunks.clear();
  }
}
