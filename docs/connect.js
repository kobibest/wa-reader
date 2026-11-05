// WA Reader consent page = the OAuth authorization endpoint of the WA Reader connector.
// Claude opens it with ?response_type=code&client_id&redirect_uri&state&code_challenge&code_challenge_method=S256.
// The extension's content script (connect-cs.js) answers here; on Approve it hands over the personal key,
// the relay seals it into a 5-minute one-time code, and we send the browser back to Claude.
(() => {
  const FN = 'https://igmqqdexoqwulvknvrnj.supabase.co/functions/v1/wa-mcp';
  const q = new URLSearchParams(location.search);
  const p = {
    response_type: q.get('response_type'),
    client_id: q.get('client_id') || '',
    redirect_uri: q.get('redirect_uri') || '',
    state: q.get('state'),
    code_challenge: q.get('code_challenge') || '',
    code_challenge_method: q.get('code_challenge_method') || '',
  };
  const $ = (id) => document.getElementById(id);
  const show = (id) => document.querySelectorAll('.state').forEach((el) => el.classList.toggle('on', el.id === id));
  const fail = (msg) => { $('errMsg').textContent = msg; show('sErr'); };

  function redirectAllowed(uri) {
    let u; try { u = new URL(uri); } catch { return false; }
    if (u.protocol === 'https:' && (u.hostname === 'claude.ai' || u.hostname === 'claude.com') && u.pathname === '/api/mcp/auth_callback') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  }
  function backTo(params) {
    const u = new URL(p.redirect_uri);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    if (p.state != null) u.searchParams.set('state', p.state);
    location.replace(u.toString());
  }

  if (!p.redirect_uri) return fail('הדף הזה נפתח מתוך Claude בזמן הוספת החיבור. אין צורך לפתוח אותו ישירות.');
  if (!redirectAllowed(p.redirect_uri)) return fail('הבקשה לא הגיעה מ-Claude, ולכן נחסמה.');
  if (p.response_type !== 'code' || p.code_challenge_method !== 'S256' || !p.code_challenge) return backTo({ error: 'invalid_request', error_description: 'PKCE S256 required' });

  // Talk to the extension's content script
  let ext = null;
  const pending = {};
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.waReader !== true || d.from !== 'ext') return;
    if (d.type === 'here') { ext = d; pending.here?.(d); }
    else if (d.type === 'here-early') { if (!ext) hello(); }
    else if (d.type === 'key') pending.key?.(d);
  });
  const send = (type) => window.postMessage({ waReader: true, from: 'page', type }, location.origin);
  const hello = () => send('hello');
  const ask = (type, ms) => new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    pending[type === 'hello' ? 'here' : 'key'] = (d) => { clearTimeout(t); resolve(d); };
    send(type);
  });

  async function detect() {
    show('sWait');
    let d = null;
    for (let i = 0; i < 3 && !d; i++) d = await ask('hello', 700);
    if (!d) return show('sNoExt');
    if (!d.activated) return show('sInactive');
    show('sAsk');
  }

  $('approve').onclick = async () => {
    $('approve').disabled = true;
    show('sBusy');
    try {
      const k = await ask('getKey', 4000);
      if (!k) return show('sNoExt');
      if (!k.ok) return k.error === 'not_activated' ? show('sInactive') : fail('התוסף לא החזיר מפתח.');
      const r = await fetch(`${FN}/oauth/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: k.secret, client_id: p.client_id, redirect_uri: p.redirect_uri, code_challenge: p.code_challenge, code_challenge_method: 'S256' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.code) return fail('שרת החיבור לא הגיב כמו שצריך (' + (j.error_description || r.status) + ').');
      backTo({ code: j.code });
    } catch (e) {
      fail('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.');
    }
  };
  $('retry').onclick = $('retry2').onclick = () => location.reload();
  detect();
})();
