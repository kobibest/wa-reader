# WA Reader

**מחבר את WhatsApp לכלי ה-AI שלך (Claude, Cursor ועוד) דרך MCP. קריאה בלבד, חינם, קוד פתוח.**
**Give your AI tools read-only, on-demand access to WhatsApp Web via MCP.** [English ↓](#english)

שואלים את Claude למשל "מה קרה היום בווצאפ ומה מחכה לתשובה ממני?". הוא מבקש מ-WA Reader את ההודעות הרלוונטיות, מקבל אותן ועונה. ההודעות לא נשמרות בשום מקום, והתוסף לא יכול לשלוח שום דבר.

```
Claude / Cursor  ──MCP──▶  wa-reader-mcp (במחשב שלך)  ──127.0.0.1──▶  תוסף WA Reader  ──▶  WhatsApp Web
```

## התקנה (5 דקות, פעם אחת)
1. **התוסף:** מחנות Chrome (הקישור יתווסף אחרי האישור), או מהקוד: `chrome://extensions` ← Developer mode ← Load unpacked ← התיקייה `extension`.
2. **הפעלה:** במסך שנפתח מאשרים את ההסכמה.
3. **Node.js:** אם אין לכם, מתקינים מ-[nodejs.org](https://nodejs.org/), גרסה 18 ומעלה.
4. **חיבור לכלי AI:** בחלון התוסף לוחצים "חיבור לכלי AI והגדרות", בוחרים את הכלי (Claude לדסקטופ, Claude Code, Cursor) ומעתיקים את ההגדרה. הטוקן האישי כבר בפנים.
5. **סוגרים ופותחים מחדש את כלי ה-AI**, ומשאירים את web.whatsapp.com פתוח בכרום.

דוגמה להגדרה ל-Claude לדסקטופ (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["-y", "github:kobibest/wa-reader"],
      "env": { "WA_READER_TOKEN": "<הטוקן מהגדרות התוסף>" }
    }
  }
}
```
ב-Windows: `"command": "cmd"`, `"args": ["/c", "npx", "-y", "github:kobibest/wa-reader"]`. מסך ההגדרות של התוסף מכין את זה אוטומטית.

## הכלים שה-AI מקבל
| כלי | מה הוא עושה |
|---|---|
| `whatsapp_status` | האם WhatsApp מחובר |
| `whatsapp_recent_messages` | כל ההודעות מ-N השעות האחרונות, לפי שיחה. מתאים לשאלות כמו "מה קרה היום" |
| `whatsapp_list_chats` | רשימת שיחות: לא נקראו, ממתינות לתשובה ממני, פרטיות, קבוצות |
| `whatsapp_get_messages` | הודעות משיחה אחת, לפי שם או מזהה, בטווח תאריכים |
| `whatsapp_search` | חיפוש טקסט בהודעות האחרונות |

אין כלי ששולח, מוחק או מסמן הודעות.

## למה אפשר לסמוך עליו
- **קריאה בלבד.** ברגע שהתוסף מתחבר, הוא לוקח רק פונקציות קריאה ומוחק מהדף את כל ממשק הספרייה, כולל שליחה, מחיקה וסימון כנקרא. ראו [`extension/page/page.js`](extension/page/page.js).
- **שום דבר לא נשמר.** כל בקשה נקראת ישירות מה-WhatsApp Web הפתוח. בתוסף אין מסד נתונים, אין שרת, אין אנליטיקס ואין מעקב.
- **החיבור המקומי סגור לאחרים.** השרת מאזין רק ל-127.0.0.1. הוא מקבל רק את התוסף, ורק עם הטוקן האישי. בקשות מדפי אינטרנט נחסמות. ראו [`mcp/bridge.js`](mcp/bridge.js).
- **החרגת שיחות.** שיחות שמוסיפים בהגדרות לא נמסרות ל-AI אף פעם.
- **שימו לב:** את מה שכלי ה-AI מקבל הוא מעבד לפי מדיניות הפרטיות שלו. למשל Claude שולח את זה לשרתים של Anthropic, כמו כל שאלה אחרת שתשאלו אותו.

## פיתוח
```bash
npm install
WA_READER_TOKEN=<token> node mcp/server.js   # שרת ה-MCP (stdio)
./scripts/update-wa-js.sh                   # עדכון WA-JS כשווצאפ משתנה
./scripts/package.sh                        # ZIP לחנות
```

## חשוב לדעת
התוסף לא קשור ל-WhatsApp או ל-Meta ולא מאושר על ידן. הוא קורא נתונים מתוך WhatsApp Web בדרך לא רשמית, ועדכונים של WhatsApp עלולים לשבור אותו זמנית. השימוש באחריותכם. [מדיניות פרטיות](https://kobibest.github.io/wa-reader/privacy.html)

## מי בנה את זה

<a href="https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader"><img src="docs/eitan-mark.svg" width="56" align="right" alt="איתן | דיגיטציה ארגונית"></a>

**[איתן | דיגיטציה ארגונית](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader)**, קובי איתן.
אני בונה לעסקים מערכות, אוטומציות וסוכני AI שחוסכים עבודה ידנית. רוצים לחבר את הווצאפ ל-CRM, או לבנות סוכן AI לעסק? [לשיחת ייעוץ ראשונית חינם](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader#contact)

---

<a id="english"></a>
## English

Ask Claude "what happened on WhatsApp today and what do I still need to reply to?". The AI calls WA Reader's MCP tools, the extension reads the answer live from your open WhatsApp Web tab, and nothing is stored.

**Setup:** install the extension (`extension/` folder, or the Chrome Web Store), activate it, install Node.js 18+, then open the extension's settings and copy the ready-made MCP config (it includes your personal token) into Claude Desktop, Claude Code, Cursor or any MCP client. Restart the AI tool and keep web.whatsapp.com open.

**Tools:** `whatsapp_status`, `whatsapp_recent_messages`, `whatsapp_list_chats`, `whatsapp_get_messages`, `whatsapp_search`. All of them are read-only. None of them can send, delete or mark messages.

**Security:** read functions are captured and the WA-JS global is deleted from the page. The local bridge listens on 127.0.0.1 only, requires a per-install token, accepts WebSocket connections only from `chrome-extension://` origins, and rejects any HTTP request that carries a browser `Origin`. Excluded chats are never returned. Data you give an AI tool is processed under that tool's privacy policy.

Built by [Kobi Eitan – Eitan | Organizational Digitization](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader). Not affiliated with WhatsApp or Meta. Uses [WA-JS](https://github.com/wppconnect-team/wa-js) (Apache 2.0). Code is MIT-licensed. [Privacy policy](https://kobibest.github.io/wa-reader/privacy.html).
