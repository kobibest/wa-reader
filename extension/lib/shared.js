// Settings + digest formatting, shared by the service worker and the UI pages.

export const DEFAULTS = {
  includeGroups: true,
  includeArchived: false,
  includeChannels: false,
  skipMuted: false,
  perChat: 200,
  maxChats: 300,
  syncEveryMin: 30,
  retentionDays: 14,
  autoExport: false,
  exportTime: '23:30',
  exportFolder: 'WhatsApp-Digest',
  excludeChats: '',      // one chat name or id per line – never stored, never exported
  webhookUrl: '',
  webhookSecret: ''
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(settings || {}) };
}

export function excludeMatcher(text) {
  const list = (text || '').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return () => false;
  return (m) => {
    const n = (m.chatName || '').toLowerCase();
    const id = (m.chatId || '').toLowerCase();
    return list.some((x) => n === x || id === x || id.split('@')[0] === x);
  };
}

export function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
}

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const dmy = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const hm = (sec) => { const d = new Date(sec * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Group messages by chat, busiest-most-recent first. */
export function groupByChat(messages) {
  const map = new Map();
  for (const m of messages) {
    let g = map.get(m.chatId);
    if (!g) { g = { chatId: m.chatId, chatName: m.chatName, isGroup: m.isGroup, muted: m.muted, msgs: [] }; map.set(m.chatId, g); }
    g.chatName = m.chatName || g.chatName;
    g.msgs.push(m);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.msgs.sort((a, b) => a.t - b.t);
    g.last = g.msgs[g.msgs.length - 1]?.t || 0;
    g.incoming = g.msgs.filter((m) => !m.fromMe).length;
    // "waiting for me" = last message in the window is not mine
    g.awaitingReply = !g.msgs[g.msgs.length - 1]?.fromMe;
  }
  groups.sort((a, b) => b.last - a.last);
  return groups;
}

export const SUMMARY_PROMPT =
`להלן ייצוא הודעות ווצאפ. סכם לי בעברית:
1. מה דורש ממני תגובה או פעולה (מי, מה, עד מתי) – הכי חשוב ראשון.
2. התחייבויות שלי ("אני אשלח", "אחזור אליך") שעוד לא בוצעו.
3. פגישות, תאריכים ומספרים שהוזכרו.
4. שאר השיחות – שורה אחת לכל שיחה. דלג על קבוצות שאין בהן משהו שנוגע אליי.
`;

export function toMarkdown(messages, { fromMs, toMs, withPrompt = false } = {}) {
  const groups = groupByChat(messages);
  const title = fromMs && toMs && ymd(fromMs) === ymd(toMs - 1)
    ? `ווצאפ – ${dmy(fromMs)}`
    : `ווצאפ – ${dmy(fromMs || Date.now())} עד ${dmy((toMs || Date.now()) - 1)}`;
  const lines = [];
  if (withPrompt) lines.push(SUMMARY_PROMPT, '---', '');
  lines.push(`# ${title}`, '');
  lines.push(`${messages.length} הודעות · ${groups.length} שיחות · ${groups.filter((g) => g.awaitingReply && !g.isGroup).length} שיחות פרטיות שההודעה האחרונה בהן לא ממני`, '');
  for (const g of groups) {
    const tags = [g.isGroup ? 'קבוצה' : 'פרטי', g.muted ? 'מושתק' : '', g.awaitingReply && !g.isGroup ? 'ממתין לי' : ''].filter(Boolean).join(' · ');
    lines.push(`## ${g.chatName} (${tags}) – ${g.msgs.length}`);
    const multiDay = g.msgs.length && ymd(g.msgs[0].t * 1000) !== ymd(g.last * 1000);
    for (const m of g.msgs) {
      const when = multiDay ? `${dmy(m.t * 1000).slice(0, 5)} ${hm(m.t)}` : hm(m.t);
      const q = m.quoted ? ` (בתגובה ל: "${m.quoted.replace(/\s+/g, ' ')}")` : '';
      const fw = m.forwarded ? ' [הועבר]' : '';
      lines.push(`- [${when}] **${m.sender}**${fw}: ${(m.text || '').replace(/\s*\n\s*/g, ' ⏎ ')}${q}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
