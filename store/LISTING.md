# Chrome Web Store – טקסטים להעתקה

כל השדות שהדשבורד מבקש, לפי הלשוניות שלו. את הקבצים מעלים מהתיקייה `store/`, ואת ה-ZIP בונים עם `scripts/package.sh`.

---

## לשונית Package
מעלים את `dist/wa-reader-<version>.zip`.

## לשונית Store listing

**Category:** Productivity → Communication. אם הקטגוריה הזו לא מופיעה, בוחרים Workflow & Planning.
**Language:** Hebrew. אחר כך מוסיפים English עם הטקסט האנגלי מלמטה.

### תיאור מפורט (עברית)
```
WA Reader מרכז את כל הודעות הווצאפ של היום במקום אחד, ומאפשר לסכם אותן ב-AI בלחיצה אחת.

מה מקבלים:
• דף סיכום יומי, מסודר לפי שיחה, עם סימון "ממתין לך" בשיחות שבהן ההודעה האחרונה לא ממך
• סינון: היום, אתמול, 7 ימים או תאריך מסוים · רק פרטיות או גם קבוצות · חיפוש לפי שם שיחה
• "העתק לסיכום ב-AI": מעתיק את ההודעות יחד עם בקשת סיכום מוכנה, להדבקה ב-Claude, ב-ChatGPT או ב-Gemini
• ייצוא ל-Markdown ול-JSON, וייצוא יומי אוטומטי לקובץ
• החרגת שיחות (משפחה, רפואי וכו'), כך שהן לא נשמרות בכלל
• Webhook אופציונלי לחיבור לאוטומציות (Make, n8n, Supabase)

פרטיות ובטיחות:
• קריאה בלבד: התוסף לא יכול לשלוח, למחוק או לסמן הודעות כנקראו. ברגע שהוא נטען, הוא מנתק מהדף את הפונקציות שעושות את זה.
• בלי וי כחול על הודעות שהוא קורא
• הכול נשמר רק בדפדפן שלך. אין שרת, אין אנליטיקס ואין מעקב.
• שום דבר לא קורה לפני שאתה מאשר במסך ההפעלה. כיבוי בהגדרות מוחק את כל הנתונים.
• קוד פתוח: github.com/kobibest/wa-reader

איך מתחילים:
1. מתקינים ומאשרים במסך ההפעלה
2. פותחים את web.whatsapp.com
3. לוחצים על אייקון התוסף, ואז "פתח סיכום יומי"

התוסף עובד כשטאב של WhatsApp Web פתוח בכרום.

WA Reader הוא פרויקט עצמאי ולא קשור ל-WhatsApp או ל-Meta.
```

### Detailed description (English)
```
WA Reader collects today's WhatsApp messages in one place and lets you summarize them with any AI in one click.

What you get:
• A daily digest grouped by chat, with "waiting for you" flags on chats where the last message isn't yours
• Filters: today, yesterday, last 7 days or a specific date · direct chats only or groups too · search by chat name
• "Copy for AI summary": copies the messages with a ready-made summary prompt for Claude, ChatGPT or Gemini
• Export to Markdown and JSON, plus an optional automatic daily export file
• Exclude chats (family, medical, etc.) so they are never stored
• Optional webhook for your automations (Make, n8n, Supabase)

Privacy and safety:
• Read-only: the extension cannot send, delete or mark messages as read. When it loads, it removes those functions from the page.
• No blue ticks for messages it reads
• Everything stays in your browser. No server, no analytics, no tracking.
• Nothing happens until you agree on the activation screen. Turning it off in settings deletes all data.
• Open source: github.com/kobibest/wa-reader

Getting started:
1. Install and agree on the activation screen
2. Open web.whatsapp.com
3. Click the extension icon, then "Open daily digest"

Works while a WhatsApp Web tab is open in Chrome.

WA Reader is an independent project, not affiliated with WhatsApp or Meta.
```

**Graphic assets:**
- Store icon: `store/icon-128.png`
- Screenshots: `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-3.png` (1280×800)
- Small promo tile: `store/promo-tile-440x280.png`

**Official URL:** אפשר להשאיר ריק.
**Homepage URL:** `https://github.com/kobibest/wa-reader`
**Support URL:** `https://github.com/kobibest/wa-reader/issues`

---

## לשונית Privacy

**Single purpose description:**
```
Reads the user's WhatsApp Web messages (read-only) and presents them as a local daily digest that the user can review, export, or copy into an AI assistant for summarization.
```

**Permission justification:**

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings and the collected messages locally in the browser so the daily digest can be shown. |
| `alarms` | Runs a periodic sync while WhatsApp Web is open, deletes messages older than the user's retention period, and triggers the optional daily export. |
| `downloads` | Saves the optional daily digest export as a Markdown file in the user's Downloads folder. Only used if the user enables daily export or clicks export. |
| `scripting` | Registers the content scripts on web.whatsapp.com only after the user gives consent on the activation screen, and unregisters them when the user turns the extension off. |
| Host permission `https://web.whatsapp.com/*` | Required to read the user's messages inside WhatsApp Web. This is the extension's single purpose. |
| Optional host permissions (`https://*/*`, localhost) | Requested at runtime only for the single webhook URL the user types in settings, so new messages can be forwarded to the user's own automation. Never requested otherwise. |

**Remote code:** `No, I am not using remote code`. כל הקוד נמצא בחבילה, כולל WA-JS שמוטמעת בתיקייה `page/`.

**Data usage – לסמן את שתי אלה בלבד:**
- ✅ **Personally identifiable information**: שמות אנשי הקשר, ומזהי שיחה שכוללים מספרי טלפון
- ✅ **Personal communications**: תוכן ההודעות

**שלושת האישורים – לסמן את שלושתם:**
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://kobibest.github.io/wa-reader/privacy.html`

---

## לשונית Distribution
- **Payments:** Free of charge
- **Visibility:** Public
- **Regions:** All regions. אפשר לצמצם לישראל אם רוצים להתחיל בקטן.

---

## הערה לבודק (Test instructions)
אם הדשבורד מציג שדה להוראות בדיקה, מדביקים שם:
```
1. After install, the activation (consent) screen opens. Check the box and click "הפעל את התוסף" (Activate).
2. Open https://web.whatsapp.com and log in with any WhatsApp account (QR code).
3. Wait ~10 seconds, click the extension icon → "פתח סיכום יומי" (Open daily digest) to see today's messages.
The extension is read-only: it captures only read functions from the bundled WA-JS library and deletes the library's global object from the page (see page/page.js).
```
