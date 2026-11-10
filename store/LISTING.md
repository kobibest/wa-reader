# Chrome Web Store – טקסטים להעתקה (גרסה 2.4.0)

## Package
מעלים את `wa-reader-2.4.0.zip` מדף ה-Release ב-GitHub, **כעדכון לפריט הקיים** (Package ← Upload new package), לא כפריט חדש: רק כך המזהה `pihiihgmfgefkneahjhmeamnmlfapmfp` נשמר, וההרחבה ל-Claude Desktop מקבלת אותו. הקובץ בנוי בלי השדה `key`. את `wa-reader-test-2.4.0.zip` לא מעלים, הוא לבדיקה בלבד.

## Store listing

**Category:** Productivity → Developer Tools. אם הקטגוריה הזו לא מופיעה, בוחרים Workflow & Planning.

### Description (עברית)
```
WA Reader מחבר את WhatsApp Web ל-Claude Desktop, כך ש-Claude יכול לקרוא את הווצאפ שלך כשאתה שואל. הכול נשאר במחשב שלך.

שואלים את Claude Desktop, למשל:
• "אילו שיחות מחכות לתשובה ממני בווצאפ?"
• "מה דנה כתבה לי השבוע?"
• "חפש בווצאפ את המילה חשבונית"
• "שמור לי את החוזה שדנה שלחה"

מה Claude יכול לעשות:
• לראות רשימת שיחות, כולל שיחות שלא נקראו ושיחות שמחכות לתשובה ממך
• לקרוא שיחה מסוימת
• לחפש טקסט בהודעות
• לקבל קובץ של הודעה מסוימת: תמונה, מסמך, הודעה קולית או סרטון (עד 20MB)

פרטיות ובטיחות:
• מקומי בלבד: התוסף מדבר רק עם Claude Desktop במחשב שלך (127.0.0.1). אין שרת של WA Reader, אין אנליטיקס ואין מעקב.
• ההודעות לא יוצאות מהמחשב, חוץ ממה ש-Claude מבקש ומעביר ל-Anthropic כחלק מהשיחה.
• קריאה בלבד: אי אפשר לשלוח, למחוק או לסמן הודעות כנקראו.
• הודעות לא נשמרות: כל בקשה נקראת מ-WhatsApp Web, נמסרת ונשכחת.
• קבצים רק לפי בקשה: קובץ ש-Claude מבקש נשמר בתיקייה Downloads/WA Reader במחשב שלך. תמונה או הודעה קולית נמסרות ל-Claude כמו שהן. התוסף לא מתמלל: לתמלול צריך כלי תמלול שמחובר ל-Claude. מדיה לצפייה חד-פעמית לא נמסרת.
• אפשר להחריג שיחות, ואז Claude לא יראה אותן לעולם.
• קוד פתוח: github.com/kobibest/wa-reader

התקנה (שני צעדים):
1. מתקינים את התוסף ומאשרים במסך ההפעלה.
2. מורידים את wa-reader.mcpb מ-github.com/kobibest/wa-reader/releases, וב-Claude Desktop: Settings ← Desktop app ← Extensions (Manage) ← Advanced settings ← Install Extension… ← בוחרים את הקובץ.
משאירים את web.whatsapp.com פתוח בכרום.

עובד רק עם Claude Desktop (Windows ו-Mac). לא עובד עם claude.ai בדפדפן או עם האפליקציה בטלפון.

נבנה על ידי איתן | דיגיטציה ארגונית (digital.m-eitan.co.il). WA Reader הוא פרויקט עצמאי ולא קשור ל-WhatsApp, ל-Meta או ל-Anthropic.
```

### Detailed description (English)
```
WA Reader connects WhatsApp Web to Claude Desktop, so Claude can read your WhatsApp when you ask. Everything stays on your computer.

Ask Claude Desktop, for example:
• "Which WhatsApp chats are waiting for my reply?"
• "What did Dana send me this week?"
• "Search WhatsApp for invoice"
• "Save the contract Dana sent me"

What Claude can do:
• List chats, including unread chats and chats waiting for your reply
• Read one chat
• Search message text
• Get the file of one message: image, document, voice message or video (up to 20 MB)

Privacy and safety:
• Local only: the extension talks only to Claude Desktop on your computer (127.0.0.1). There is no WA Reader server, no analytics and no tracking.
• Messages never leave your computer, except what Claude asks for, which Claude Desktop sends to Anthropic as part of your conversation.
• Read-only: it cannot send, delete or mark messages as read.
• Messages are not stored: each request is read live from WhatsApp Web, handed over and forgotten.
• Files only on request: a file Claude asks for is saved in the Downloads/WA Reader folder on your computer. An image or a voice message is handed to Claude as it is. WA Reader does not transcribe: for a transcript you need a transcription tool connected to Claude. View-once media is never handed over.
• Exclude chats so Claude never sees them.
• Open source: github.com/kobibest/wa-reader

Setup (two steps):
1. Install the extension and agree on the activation screen.
2. Download wa-reader.mcpb from github.com/kobibest/wa-reader/releases. In Claude Desktop: Settings → Desktop app → Extensions (Manage) → Advanced settings → Install Extension… → choose the file.
Keep web.whatsapp.com open in Chrome.

Works only with Claude Desktop (Windows and Mac). It does not work with claude.ai in the browser or the mobile app.

Built by Eitan | Organizational Digitization (digital.m-eitan.co.il). WA Reader is an independent project, not affiliated with WhatsApp, Meta or Anthropic.
```

**התמונות:** `store/icon-128.png`, `store/screenshot-*.png`, `store/promo-tile-440x280.png` (1280×800, עודכנו ל-2.3.0: איך זה עובד, התקנה בשני צעדים, פרטיות)
**Homepage URL:** `https://github.com/kobibest/wa-reader`
**Support URL:** `https://github.com/kobibest/wa-reader/issues`

---

## Privacy

**Single purpose:**
```
Gives the user's own Claude Desktop app, running on the same computer, read-only, on-demand access to the user's WhatsApp Web messages, and to the file of a specific message when asked, over a local connection (127.0.0.1). No server, messages are not stored.
```

| Permission | Justification |
|---|---|
| `storage` | Stores the consent flag and the user's list of excluded chats. No messages are stored. |
| `alarms` | Wakes the service worker every 30 seconds to reconnect to the WA Reader extension of Claude Desktop on the same computer (ws://127.0.0.1:17345) when Claude Desktop is started after Chrome. |
| `scripting` | Registers the content scripts on web.whatsapp.com only after the user gives consent on the activation screen, and unregisters them when the user turns the extension off. |
| Host permission `https://web.whatsapp.com/*` | Required to read the user's messages, and the file attached to a specific message, inside WhatsApp Web when the user's Claude Desktop requests them. This is the extension's single purpose. |

**Remote code:** No. All code is in the package, including the WA-JS library in `page/`.

**Data usage – מסמנים את שתי אלה:**
- ✅ Personally identifiable information: שמות אנשי קשר, ומזהי שיחה שכוללים מספרי טלפון
- ✅ Personal communications: תוכן ההודעות, וקבצים והקלטות שצורפו להודעות (רק כש-Claude מבקש קובץ של הודעה מסוימת)

ומסמנים גם את **שלושת** האישורים. (הנתונים נמסרים רק ל-Claude Desktop שהמשתמש התקין במחשב שלו, וזה חלק מהמטרה היחידה.)

**Privacy policy URL:** `https://kobibest.github.io/wa-reader/privacy.html`

## Distribution
Free · Public · All regions

## Test instructions (לבודק)
```
WA Reader lets the user's Claude Desktop read WhatsApp Web over a local connection. To test:
1. Install the extension; the activation screen opens. Check the box and click "הפעל את התוסף" (Activate).
2. Open https://web.whatsapp.com and log in with any account. The popup shows a green light for "WhatsApp Web פתוח".
3. Install Claude Desktop and download wa-reader.mcpb from https://github.com/kobibest/wa-reader/releases/latest. In Claude Desktop: Settings → Desktop app → Extensions (Manage) → Advanced settings → Install Extension… → choose the file → Install. No settings are needed. The popup now shows all three lights green.
4. Ask in a regular Claude Desktop chat (Chat tab).
   For example: "Which WhatsApp chats are waiting for my reply?".
The extension connects only to ws://127.0.0.1:17345 (enforced by its content security policy). The local server accepts only this extension's origin. It only reads: it captures read functions from the bundled WA-JS library and deletes its global from the page (page/page.js). No messages are stored.
5. Optional: ask "Show me the last image I received on WhatsApp". Claude calls get_media for that one message. Images and voice messages are handed to Claude as they are; files are saved by the Claude Desktop extension in Downloads/WA Reader. The Chrome extension itself writes no files.
```
