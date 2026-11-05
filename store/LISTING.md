# Chrome Web Store – טקסטים להעתקה (גרסה 2.1.0)

## Package
מעלים את `dist/wa-reader-2.1.0.zip`. בונים אותו עם `scripts/package.sh`.

## Store listing

**Category:** Productivity → Developer Tools. אם הקטגוריה הזו לא מופיעה, בוחרים Workflow & Planning.

### Description (עברית)
```
WA Reader מחבר את הווצאפ שלך ל-Claude, כך ש-Claude יכול לקרוא אותו כשאתה שואל: ב-claude.ai, באפליקציית הדסקטופ ובטלפון.

שואלים את Claude, למשל:
• "מה קרה היום בווצאפ ומה מחכה לתשובה ממני?"
• "מה דנה כתבה לי השבוע?"
• "חפש בווצאפ את המילה חשבונית"
והוא מבקש מהתוסף בדיוק את ההודעות שהוא צריך, ועונה.

מה Claude יכול לעשות:
• לקרוא את ההודעות מהשעות או מהימים האחרונים, מסודרות לפי שיחה
• לראות אילו שיחות לא נקראו ואילו מחכות לתשובה ממך
• לקרוא שיחה מסוימת לפי שם או לפי טווח תאריכים
• לחפש טקסט בהודעות

פרטיות ובטיחות:
• קריאה בלבד: אי אפשר לשלוח, למחוק או לסמן הודעות כנקראו. ברגע שהתוסף נטען, הוא מנתק מהדף את הפונקציות שעושות את זה.
• שום דבר לא נשמר. כל בקשה נקראת ישירות מ-WhatsApp Web, עוברת מוצפנת (AES-256) דרך שרת ממסר, נמסרת ל-Claude ונשכחת.
• רק מי שמחזיק במפתח האישי שלך יכול לבקש נתונים, ורק בזמן ש-WhatsApp Web פתוח אצלך.
• אפשר להחריג שיחות (משפחה, רפואי וכו'), ואז Claude לא יראה אותן לעולם.
• מעדיפים שההודעות לא יעברו בשום שרת? יש גם חיבור מקומי ל-Claude לדסקטופ.
• אין אנליטיקס ואין מעקב. קוד פתוח: github.com/kobibest/wa-reader

איך מתחילים (פעם אחת, דקה):
1. מתקינים את התוסף ומאשרים במסך ההפעלה
2. ב-claude.ai: Customize → Connectors → Add custom connector
3. מדביקים את הכתובת ואת המפתח מהגדרות התוסף
4. משאירים את web.whatsapp.com פתוח בכרום במחשב

התוסף עובד כשטאב של WhatsApp Web פתוח בכרום במחשב. ב-Claude חינמי אפשר להוסיף חיבור מותאם אישית אחד.

נבנה על ידי איתן | דיגיטציה ארגונית (digital.m-eitan.co.il). WA Reader הוא פרויקט עצמאי ולא קשור ל-WhatsApp, ל-Meta או ל-Anthropic.
```

### Detailed description (English)
```
WA Reader connects your WhatsApp to Claude, so Claude can read it when you ask – on claude.ai, in the desktop app and on your phone.

Ask Claude, for example:
• "What happened on WhatsApp today and what do I still need to reply to?"
• "What did Dana send me this week?"
• "Search WhatsApp for invoice"
It asks the extension for exactly the messages it needs, and answers.

What Claude can do:
• Read messages from the last hours or days, grouped by chat
• See unread chats and chats waiting for your reply
• Read one chat by name or date range
• Search message text

Privacy and safety:
• Read-only: it cannot send, delete or mark messages as read. When it loads, it removes those functions from the page.
• Nothing is stored. Each request is read live from WhatsApp Web, travels encrypted (AES-256) through a relay, is handed to Claude and forgotten.
• Only someone holding your personal key can request data, and only while your WhatsApp Web is open.
• Exclude chats so Claude never sees them.
• Prefer that messages never pass through any server? A local connection for Claude Desktop is available too.
• No analytics, no tracking. Open source: github.com/kobibest/wa-reader

Getting started (once, one minute):
1. Install the extension and agree on the activation screen
2. On claude.ai: Customize → Connectors → Add custom connector
3. Paste the URL and key from the extension settings
4. Keep web.whatsapp.com open in Chrome on your computer

Works while a WhatsApp Web tab is open in Chrome on your computer. Claude's free plan allows one custom connector.

Built by Eitan | Organizational Digitization (digital.m-eitan.co.il). WA Reader is an independent project, not affiliated with WhatsApp, Meta or Anthropic.
```

**התמונות:** `store/icon-128.png`, `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-3.png`, `store/promo-tile-440x280.png`
**Homepage URL:** `https://github.com/kobibest/wa-reader`
**Support URL:** `https://github.com/kobibest/wa-reader/issues`

---

## Privacy

**Single purpose:**
```
Gives the user's own AI assistant (Claude, via a custom connector the user adds) read-only, on-demand access to the user's WhatsApp Web messages, through an end-to-end encrypted relay that stores nothing.
```

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings only: the personal connector key, the local pairing token and port, the excluded-chats list and the consent flag. No messages are stored. |
| `alarms` | Periodically re-establishes the encrypted relay connection (Supabase Realtime) or the local MCP connection after the browser or network restarts, so the user's AI assistant can reach WhatsApp Web. |
| `scripting` | Registers the content scripts on web.whatsapp.com only after the user gives consent on the activation screen, and unregisters them when the user turns the extension off. |
| Host permission `https://web.whatsapp.com/*` | Required to read the user's messages inside WhatsApp Web when the user's AI assistant requests them. This is the extension's single purpose. |

**Remote code:** No. All code is in the package, including the WA-JS library in `page/`.

**Data usage – מסמנים את שתי אלה:**
- ✅ Personally identifiable information: שמות אנשי קשר, ומזהי שיחה שכוללים מספרי טלפון
- ✅ Personal communications: תוכן ההודעות

ומסמנים גם את **שלושת** האישורים. (הנתונים עוברים דרך השרת רק כדי למסור אותם לכלי ה-AI שהמשתמש בחר, וזה חלק מהמטרה היחידה. לכן האישור "I do not sell or transfer user data to third parties, outside of the approved use cases" נכון.)

**Privacy policy URL:** `https://kobibest.github.io/wa-reader/privacy.html`

## Distribution
Free · Public · All regions

## Test instructions (לבודק)
```
WA Reader lets the user's Claude read WhatsApp Web through a custom MCP connector. To test:
1. Install the extension; the activation screen opens. Check the box and click "הפעל את התוסף" (Activate).
2. Open https://web.whatsapp.com and log in with any account. The popup shows "WhatsApp Web: connected" and "Claude: ready".
3. Open the extension settings ("חיבור ל-Claude והגדרות"). On claude.ai go to Customize → Connectors → Add custom connector, enter the URL shown, choose "No sign in", add the request header X-WA-Reader-Key with the key shown, and click Add.
4. In a Claude chat, enable the WhatsApp connector and ask "What happened on WhatsApp today?".
The extension only answers requests sealed with the user's personal key (AES-256-GCM) and only reads: it captures read functions from the bundled WA-JS library and deletes its global from the page (page/page.js). Neither the extension nor the relay (supabase/functions/wa-mcp in the open-source repo) stores messages.
```
