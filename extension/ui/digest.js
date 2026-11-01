import { startOfDay, groupByChat, toMarkdown, dmy, hm, ymd } from '../lib/shared.js';

const $ = (id) => document.getElementById(id);
const state = { from: 0, to: 0, messages: [] };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text; // textContent only – message text is never parsed as HTML
  return e;
}

function toast(t) { const x = $('toast'); x.textContent = t; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 1600); }

function setRange(kind, dayValue) {
  const today = startOfDay();
  if (kind === 'today') { state.from = today; state.to = today + 86400000; }
  else if (kind === 'yesterday') { state.from = today - 86400000; state.to = today; }
  else if (kind === 'week') { state.from = today - 6 * 86400000; state.to = today + 86400000; }
  else if (kind === 'day' && dayValue) { const d = new Date(dayValue + 'T00:00:00'); state.from = d.getTime(); state.to = state.from + 86400000; }
  document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.r === kind));
  load();
}

async function load() {
  const r = await chrome.runtime.sendMessage({ kind: 'getRange', from: state.from, to: state.to });
  state.messages = r?.ok ? r.messages : [];
  render();
}

function visible() {
  const q = $('q').value.trim().toLowerCase();
  const withGroups = $('groups').checked;
  const onlyWaiting = $('waiting').checked;
  let groups = groupByChat(state.messages).filter((g) => (withGroups || !g.isGroup) && (!q || (g.chatName || '').toLowerCase().includes(q)));
  if (onlyWaiting) groups = groups.filter((g) => g.awaitingReply && !g.isGroup);
  return groups;
}

function render() {
  const sameDay = ymd(state.from) === ymd(state.to - 1);
  $('title').textContent = sameDay ? `ווצאפ · ${dmy(state.from)}` : `ווצאפ · ${dmy(state.from)} – ${dmy(state.to - 1)}`;
  const groups = visible();
  const n = groups.reduce((a, g) => a + g.msgs.length, 0);
  const waiting = groups.filter((g) => g.awaitingReply && !g.isGroup).length;
  $('sum').textContent = `${n} הודעות · ${groups.length} שיחות · ${waiting} שיחות פרטיות שההודעה האחרונה בהן לא ממך`;

  const list = $('list');
  list.replaceChildren();
  if (!groups.length) {
    const e = el('div', 'empty muted');
    e.append(el('div', '', 'אין הודעות בטווח הזה.'), el('div', 'small', 'ודא ש-web.whatsapp.com פתוח בכרום, ולחץ "סנכרן עכשיו" בחלון התוסף.'));
    list.append(e);
    return;
  }
  const multiDay = !sameDay;
  for (const g of groups) {
    const d = el('details', 'chat');
    if (groups.length <= 6) d.open = true;
    const s = el('summary');
    s.append(el('span', 'name', g.chatName));
    s.append(el('span', 'chip', g.isGroup ? 'קבוצה' : 'פרטי'));
    if (g.awaitingReply && !g.isGroup) s.append(el('span', 'chip wait', 'ממתין לך'));
    s.append(el('span', 'chip', `${g.msgs.length}`));
    s.append(el('span', 'muted small', hm(g.last)));
    d.append(s);
    const box = el('div', 'msgs');
    for (const m of g.msgs) {
      const row = el('div', 'm' + (m.fromMe ? ' me' : ''));
      row.append(el('div', 't', multiDay ? `${dmy(m.t * 1000).slice(0, 5)} ${hm(m.t)}` : hm(m.t)));
      const body = el('div', 'body');
      if (m.quoted) body.append(el('span', 'q', m.quoted));
      body.append(el('span', 'who', m.sender + (m.forwarded ? ' (הועבר)' : '')));
      body.append(el('span', 'txt', m.text));
      row.append(body);
      box.append(row);
    }
    d.append(box);
    list.append(d);
  }
}

function currentMessages() { return visible().flatMap((g) => g.msgs); }

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  const a = el('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const fname = () => `whatsapp-${ymd(state.from)}${ymd(state.from) === ymd(state.to - 1) ? '' : '_' + ymd(state.to - 1)}`;

$('copyMd').onclick = async () => { await navigator.clipboard.writeText(toMarkdown(currentMessages(), { fromMs: state.from, toMs: state.to })); toast('הועתק'); };
$('copyPrompt').onclick = async () => { await navigator.clipboard.writeText(toMarkdown(currentMessages(), { fromMs: state.from, toMs: state.to, withPrompt: true })); toast('הועתק – הדבק בצ׳אט של ה-AI'); };
$('dlMd').onclick = () => download(fname() + '.md', toMarkdown(currentMessages(), { fromMs: state.from, toMs: state.to }), 'text/markdown;charset=utf-8');
$('dlJson').onclick = () => download(fname() + '.json', JSON.stringify({ from: new Date(state.from).toISOString(), to: new Date(state.to).toISOString(), messages: currentMessages() }, null, 2), 'application/json;charset=utf-8');

document.querySelectorAll('#seg button').forEach((b) => (b.onclick = () => { $('day').value = ''; setRange(b.dataset.r); }));
$('day').onchange = (e) => setRange('day', e.target.value);
['groups', 'waiting'].forEach((id) => ($(id).onchange = render));
$('q').oninput = render;

setRange('today');
