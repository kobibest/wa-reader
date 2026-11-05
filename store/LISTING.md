# Chrome Web Store – טקסטים להעתקה (גרסה 2.0.0)

## Package
מעלים את `dist/wa-reader-2.0.0.zip`. בונים אותו עם `scripts/package.sh`.

## Store listing

**Category:** Productivity → Developer Tools. אם הקטגוריה הזו לא מופיעה, בוחרים Workflow & Planning.

### Description (עברית)
```
WA Reader מחבר את הווצאפ שלך לאפליקציית Claude לדסקטופ, כך ש-Claude יכול לקרוא אותו כשאתה שואל.

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
• שום דבר לא נשמר. כל בקשה נקראת ישירות מ-WhatsApp Web.
• ההודעות עוברות רק בתוך המחשב שלך אל Claude, בחיבור מקומי שמוגן בטוקן אישי. אין שרת חיצוני, אין אנליטיקס ואין מעקב.
• אפשר להחריג שיחות (משפחה, רפואי וכו'), ואז Claude לא יראה אותן לעולם.
• שום דבר לא קורה לפני שאתה מאשר במסך ההפעלה.
• קוד פתוח: github.com/kobibest/wa-reader

איך מתחילים (פעם אחת, בלי התקנות נוספות):
1. מתקינים את התוסף ומאשרים במסך ההפעלה
2. בהגדרות התוסף לוחצים "הורד את ההרחבה ל-Claude"
3. לוחצים פעמיים על הקובץ, מאשרים ב-Claude ומדביקים את הטוקן מההגדרות
4. משאירים את web.whatsapp.com פתוח בכרום

חשוב: עובד רק עם אפליקציית Claude לדסקטופ (Windows / Mac). claude.ai בדפדפן ובטלפון לא יכולים להתחבר לתוסף. מפתחים יכולים לחבר גם את Claude Code, Cursor וכלי MCP אחרים (דורש Node.js).

נבנה על ידי איתן | דיגיטציה ארגונית (digital.m-eitan.co.il). WA Reader הוא פרויקט עצמאי ולא קשור ל-WhatsApp או ל-Meta.
```

### Detailed description (English)
```
WA Reader connects your WhatsApp to the Claude desktop app, so Claude can read it when you ask.

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
• Nothing is stored. Every request is read live from WhatsApp Web.
• Messages travel only inside your computer to Claude, over a local connection protected by a personal token. No external server, no analytics, no tracking.
• Exclude chats so Claude never sees them.
• Open source: github.com/kobibest/wa-reader

Getting started (once, nothing else to install):
1. Install the extension and agree on the activation screen
2. In the extension settings, click "Download the Claude extension"
3. Double-click the file, confirm in Claude and paste the token from the settings
4. Keep web.whatsapp.com open in Chrome

Important: works only with the Claude desktop app (Windows / Mac). claude.ai on the web or mobile cannot reach the extension. Developers can also connect Claude Code, Cursor and other MCP clients (requires Node.js).

Built by Eitan | Organizational Digitization (digital.m-eitan.co.il). WA Reader is an independent project, not affiliated with WhatsApp or Meta.
```

**התמונות:** `store/icon-128.png`, `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-3.png`, `store/promo-tile-440x280.png`
**Homepage URL:** `https://github.com/kobibest/wa-reader`
**Support URL:** `https://github.com/kobibest/wa-reader/issues`

---

## Privacy

**Single purpose:**
```
Gives the user's own local AI tools (MCP clients such as Claude Desktop or Cursor) read-only, on-demand access to the user's WhatsApp Web messages, through a local MCP server on the user's computer.
```

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings only: the pairing token for the local MCP server, the port, the list of excluded chats and the consent flag. No messages are stored. |
| `alarms` | Periodically re-establishes the connection to the local MCP server (127.0.0.1) so the AI tool can reach WhatsApp after the browser or the AI tool restarts. |
| `scripting` | Registers the content scripts on web.whatsapp.com only after the user gives consent on the activation screen, and unregisters them when the user turns the extension off. |
| Host permission `https://web.whatsapp.com/*` | Required to read the user's messages inside WhatsApp Web when the user's AI tool requests them. This is the extension's single purpose. |

**Remote code:** No. All code is in the package, including the WA-JS library in `page/`.

**Data usage – מסמנים את שתי אלה:**
- ✅ Personally identifiable information: שמות אנשי קשר, ומזהי שיחה שכוללים מספרי טלפון
- ✅ Personal communications: תוכן ההודעות

ומסמנים גם את **שלושת** האישורים.

**Privacy policy URL:** `https://kobibest.github.io/wa-reader/privacy.html`

## Distribution
Free · Public · All regions

## Test instructions (לבודק)
```
WA Reader is a bridge between WhatsApp Web and the user's local MCP client. To test:
1. Install the extension; the activation screen opens. Check the box and click "הפעל את התוסף" (Activate).
2. Open https://web.whatsapp.com and log in with any account.
3. Open the extension settings ("חיבור לכלי AI והגדרות"), download the Claude Desktop extension (wa-reader.mcpb), install it in Claude Desktop and paste the token shown there. (Alternatively with Node.js 18+: choose "Claude Code" and run the shown command.) The MCP server source is in the same open-source repo (github.com/kobibest/wa-reader, folder mcp/).
4. Restart the MCP client and ask it: "What happened on WhatsApp today?". The popup shows both WhatsApp Web and the AI tool as connected.
The extension only answers read requests from a local server on 127.0.0.1 that presents the per-install token; it captures only read functions from the bundled WA-JS library and deletes its global from the page (page/page.js). It stores no messages.
```
