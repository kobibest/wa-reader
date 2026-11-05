# WA Reader

**מחבר את WhatsApp ל-Claude: באתר, בדסקטופ ובטלפון. קריאה בלבד, מוצפן, שום דבר לא נשמר. חינם וקוד פתוח.**
**Lets Claude read your WhatsApp Web on demand – read-only, encrypted, nothing stored.** [English ↓](#english)

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-להתקנה-0f7a5c?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/pihiihgmfgefkneahjhmeamnmlfapmfp)

שואלים את Claude, למשל: "מה קרה היום בווצאפ ומה מחכה לתשובה ממני?". הוא מבקש מ-WA Reader את ההודעות הרלוונטיות, מקבל אותן ועונה. ההודעות לא נשמרות בשום מקום, והתוסף לא יכול לשלוח שום דבר.

```
Claude (web / desktop / mobile)
   │  MCP (HTTPS)
   ▼
wa-mcp  – Supabase Edge Function, stateless, stores nothing
   │  Supabase Realtime – AES-256-GCM, end to end
   ▼
WA Reader extension (Chrome)  ──▶  WhatsApp Web
```

## התקנה (דקה, פעם אחת)
1. מתקינים את התוסף [מחנות Chrome](https://chromewebstore.google.com/detail/pihiihgmfgefkneahjhmeamnmlfapmfp) ומאשרים במסך ההפעלה.
2. בהגדרות התוסף ("חיבור ל-Claude והגדרות") מופיעים כתובת ומפתח אישי.
3. ב-[claude.ai](https://claude.ai/settings/connectors): **Customize → Connectors → + Add → Add custom connector**.
   - Name: `WhatsApp` · URL: הכתובת מההגדרות ← Continue
   - Authentication: **No sign in** · Request headers: `x-api-key` = המפתח מההגדרות ← Add
4. משאירים את web.whatsapp.com פתוח בכרום במחשב, מפעילים את החיבור בצ'אט ושואלים.

> ב-Claude חינמי אפשר להוסיף חיבור מותאם אישית אחד. החיבור עובד רק בזמן ש-WhatsApp Web פתוח בכרום במחשב.

### חיבור מקומי (מתקדם, בלי שרת)
מי שמעדיף שההודעות לא יעברו בשום שרת יכול להתחבר מקומית:
- **Claude לדסקטופ:** מורידים את [wa-reader.mcpb](https://kobibest.github.io/wa-reader/wa-reader.mcpb), לוחצים עליו פעמיים, ומדביקים את הטוקן המקומי מהגדרות התוסף.
- **Claude Code, Cursor ואחרים (דורש Node.js 18+):** ההגדרה המוכנה נמצאת בהגדרות התוסף, בחלק "חיבור מקומי".

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
- **שום דבר לא נשמר.** התוסף לא שומר הודעות. שרת הממסר ([`supabase/functions/wa-mcp`](supabase/functions/wa-mcp)) לא כותב לשום מסד נתונים, קובץ או יומן, ומחזיק את התשובה בזיכרון רק עד שהוא מוסר אותה ל-Claude.
- **מוצפן מקצה לקצה.** מהמפתח האישי נגזרים שם ערוץ שאי אפשר לנחש ומפתח AES-256-GCM. Supabase Realtime רואה רק טקסט מוצפן, והתוסף מתעלם מכל בקשה שלא הוצפנה במפתח שלך או שהיא ישנה או חוזרת. ראו [`shared/relay-crypto.js`](shared/relay-crypto.js).
- **המפתח לא ביומנים.** הוא נשלח בכותרת `x-api-key` ולא בכתובת, כי Supabase שומר ביומנים את הכתובת המלאה.
- **החרגת שיחות.** שיחות שמוסיפים בהגדרות לא נמסרות ל-Claude אף פעם.
- **שימו לב:** את מה ש-Claude מקבל הוא מעבד לפי מדיניות הפרטיות של Anthropic, כמו כל שאלה אחרת שתשאלו אותו.

## פיתוח
```bash
npm install
WA_READER_TOKEN=<token> node mcp/server.js   # שרת ה-MCP (stdio)
./scripts/update-wa-js.sh                   # עדכון WA-JS כשווצאפ משתנה
./scripts/package.sh                        # ZIP לחנות
./scripts/build-mcpb.sh                     # ההרחבה המקומית ל-Claude לדסקטופ (docs/wa-reader.mcpb)
./scripts/sync-shared.sh                    # מעתיק את shared/ לתוסף ולפונקציה
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

Ask Claude "what happened on WhatsApp today and what do I still need to reply to?". Claude calls the WA Reader connector, the relay forwards the encrypted request to your extension, the extension reads the answer live from your open WhatsApp Web tab, and nothing is stored anywhere.

**Setup:** install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/pihiihgmfgefkneahjhmeamnmlfapmfp) and activate it. On claude.ai go to Customize → Connectors → Add custom connector, paste the URL from the extension settings, choose "No sign in", add the request header `x-api-key` with your personal key, and keep web.whatsapp.com open in Chrome. Works on claude.ai, Claude Desktop and mobile.

**Local option (no server):** the Claude Desktop extension [wa-reader.mcpb](https://kobibest.github.io/wa-reader/wa-reader.mcpb) or `npx -y github:kobibest/wa-reader` for Claude Code / Cursor talk to the extension over 127.0.0.1 only.

**Tools:** `whatsapp_status`, `whatsapp_recent_messages`, `whatsapp_list_chats`, `whatsapp_get_messages`, `whatsapp_search`. All of them are read-only.

**Security:** read functions are captured and the WA-JS global is deleted from the page. The relay is a stateless Supabase Edge Function. Relay ↔ extension traffic goes over Supabase Realtime, sealed with AES-256-GCM using a key derived from the per-install secret, with replay protection, so Realtime only sees ciphertext. The secret travels in a request header, never in the URL, so it is not in request logs. Excluded chats are never returned.

Built by [Kobi Eitan – Eitan | Organizational Digitization](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader). Not affiliated with WhatsApp or Meta. Uses [WA-JS](https://github.com/wppconnect-team/wa-js) (Apache 2.0). Code is MIT-licensed. [Privacy policy](https://kobibest.github.io/wa-reader/privacy.html).
