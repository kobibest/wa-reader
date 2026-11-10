# WA Reader

**גשר מקומי בין WhatsApp Web ל-Claude Desktop: הודעות, קבצים והקלטות. קריאה בלבד, בלי שרת, הודעות לא נשמרות. חינם וקוד פתוח.**

> ⚠️ **עובד רק עם Claude Desktop** (Windows ו-Mac). לא עובד עם claude.ai בדפדפן ולא עם האפליקציה בטלפון.

שואלים את Claude Desktop, למשל: "אילו שיחות בווצאפ מחכות לתשובה ממני?". Claude מבקש מ-WA Reader בדיוק את ההודעות שהוא צריך, התוסף קורא אותן מ-WhatsApp Web שפתוח בכרום, ו-Claude עונה. התוסף לא יכול לשלוח שום דבר.

## התקנה (שני צעדים)

1. **התוסף לכרום:** מתקינים את WA Reader [מחנות Chrome](https://chromewebstore.google.com/detail/pihiihgmfgefkneahjhmeamnmlfapmfp) ומאשרים במסך ההפעלה.
2. **ההרחבה ל-Claude Desktop:** מורידים את [**wa-reader.mcpb**](https://github.com/kobibest/wa-reader/releases/latest/download/wa-reader.mcpb). ב-Claude Desktop נכנסים ל-**Settings ← Desktop app**, לוחצים **Manage** ליד **Extensions**, ואז **Advanced settings ← Install Extension…**, בוחרים את הקובץ ולוחצים **Install**.

זהו, בלי שום הגדרה. משאירים את [web.whatsapp.com](https://web.whatsapp.com) פתוח בכרום, ושואלים את Claude **בשיחה רגילה (לשונית Chat)**. שיחות Claude Code בענן לא רואות הרחבות מקומיות.
בחלון של התוסף מופיעות שלוש נורות: **WhatsApp Web פתוח**, **מחובר ל-Claude Desktop**, **מוכן**. כשכולן ירוקות, Claude יכול לקרוא.

> לא צריך להתקין Node.js: Claude Desktop מריץ את ההרחבה בעצמו.

## איך זה עובד

```
Claude Desktop
   │  MCP (stdio)
   ▼
wa-reader.mcpb ── שרת מקומי ──  ws://127.0.0.1:17345  (מקבל חיבור רק מהתוסף WA Reader)
                                      ▲
                                      │  WebSocket, בתוך המחשב בלבד
                                      │
              התוסף WA Reader בכרום ──▶ WhatsApp Web
```

- ההרחבה ל-Claude Desktop מריצה שרת MCP ובאותו תהליך שרת WebSocket שמאזין **רק על 127.0.0.1**, בפורט 17345.
- השרת מקבל חיבור רק כשכותרת ה-Origin היא בדיוק `chrome-extension://<המזהה של WA Reader>`. דפי אינטרנט, תוספים אחרים ומחשבים אחרים ברשת נדחים.
- בכל רגע יש חיבור פעיל אחד. חיבור חדש מחליף את הקודם.
- התוסף מתחבר עם ניסיונות חוזרים, ושולח ping כל 20 שניות כדי שה-service worker של כרום לא ייכבה.
- כל בקשה מקבלת תשובה תוך 15 שניות, או שגיאה ברורה.

## הכלים ש-Claude מקבל

| כלי | מה הוא עושה |
|---|---|
| `whatsapp_status` | האם התוסף מחובר ו-WhatsApp Web טעון |
| `list_chats` | רשימת שיחות: לא נקראו, ממתינות לתשובה ממני, פרטיות, קבוצות (עד 200) |
| `get_messages` | הודעות משיחה אחת, לפי שם או מזהה (עד 200) |
| `search` | חיפוש טקסט בהודעות האחרונות (עד 100 תוצאות) |
| `get_media` | הקובץ של הודעה אחת: תמונה, מסמך, הודעה קולית, אודיו, וידאו או סטיקר (עד 20MB) |

כל הכלים רק קוראים מ-WhatsApp. אין כלי ששולח, מוחק או מסמן הודעות. אם התוסף לא מחובר, Claude מקבל את ההודעה: "פתח את WhatsApp Web בכרום ובדוק שהתוסף פעיל".

### קבצים והקלטות

ליד כל הודעה שיש בה קובץ, Claude רואה מזהה (`media_id`), ויכול לבקש את הקובץ עם `get_media`. למשל: "תראה לי את התמונה שדנה שלחה", "שמור לי את החוזה שקיבלתי מרואה החשבון", "תוריד את ההודעה הקולית האחרונה של אבי".

- **תמונות** מוצגות ל-Claude, והוא יכול לתאר ולקרוא אותן. הן לא נשמרות במחשב, אלא אם מבקשים.
- **הודעות קוליות ואודיו** נמסרים ל-Claude כמו שהם: ההקלטה המקורית, בלי המרה ובלי תמלול (עד כ-700KB, בערך 5 דקות של הודעה קולית). הם גם נשמרים בתיקייה, והקלטה ארוכה יותר רק נשמרת.
- **מסמכים ווידאו** נשמרים בתיקייה `Downloads/WA Reader` (הורדות ← WA Reader), ו-Claude מקבל את המיקום של הקובץ. קובץ טקסט קטן (txt, csv, json) נמסר ל-Claude גם כטקסט.
- **WA Reader לא מתמלל.** מי שרוצה תמלול צריך כלי תמלול שמחובר ל-Claude, ו-Claude יפעיל אותו על ההקלטה. בלי כלי כזה Claude יגיד שצריך לחבר אחד.
- עד 20MB לקובץ. מדיה לצפייה חד-פעמית לא נמסרת. קובץ קיים לא נדרס. שם הקובץ מנוקה, כך ששולח לא יכול לקבוע איפה הוא נשמר.
- מדיה ישנה שכבר לא נמצאת בשרתים של WhatsApp לא תרד, עד שמורידים אותה שוב בטלפון.
- אפשר לשנות את התיקייה עם משתנה הסביבה `WA_READER_MEDIA_DIR`.

## פרטיות ואבטחה

- **ההודעות לא יוצאות מהמחשב**, חוץ ממה ש-Claude מבקש ו-Claude Desktop מעביר ל-Anthropic כחלק מהשיחה.
- **אפס קריאות רשת חיצוניות.** אין שרת של WA Reader, אין טלמטריה ואין אנליטיקס. ב-manifest של התוסף, מדיניות ה-CSP מתירה חיבור רק ל-`ws://127.0.0.1:17345`. האפשרויות של WA-JS שפונות לשרתים חיצוניים (Google Analytics, שרתי תצוגה מקדימה לקישורים) כבויות ([`extension/page/config.js`](extension/page/config.js)).
- **הודעות לא נשמרות.** הודעות לא נכתבות לדיסק או ל-`chrome.storage`. כל בקשה נמצאת בזיכרון רק עד שהתשובה נמסרת. באחסון של התוסף נשמרים רק ההסכמה ורשימת השיחות המוחרגות.
- **קבצים נשמרים רק כשמבקשים.** הדבר היחיד שנכתב לדיסק הוא קובץ ש-Claude ביקש עם `get_media`, והוא נשמר בתיקייה `Downloads/WA Reader` במחשב שלך ונשאר שם עד שתמחק אותו. ראו [`mcp/media.js`](mcp/media.js). התוסף בכרום עצמו לא כותב קבצים.
- **קריאה בלבד.** ברגע שהתוסף נטען, הוא לוקח רק את פונקציות הקריאה ומוחק מהדף את ממשק הספרייה, כולל שליחה, מחיקה וסימון כנקרא. ראו [`extension/page/page.js`](extension/page/page.js).
- **החרגת שיחות.** שיחות שמוסיפים בהגדרות התוסף לא נמסרות ל-Claude אף פעם.
- [מדיניות פרטיות](https://kobibest.github.io/wa-reader/privacy.html)

## פיתוח

```bash
npm install
npm test                      # בדיקות: Origin, החלפת חיבור, פרוטוקול, הגדרות פרטיות, שמירת קבצים
./scripts/build-mcpb.sh       # dist/wa-reader.mcpb
node test/e2e.mjs             # בדיקת קצה לקצה: לקוח MCP → ה-mcpb → כרום עם התוסף → דף WhatsApp מדומה
./scripts/package.sh          # dist/wa-reader-<version>.zip לחנות + dist/wa-reader-test-<version>.zip לבדיקה
./scripts/update-wa-js.sh     # עדכון WA-JS כש-WhatsApp משתנה
```

**בדיקה לפני עדכון בחנות.** בכל Release יש קובץ `wa-reader-test-<version>.zip`. מחלצים אותו, ב-`chrome://extensions` מפעילים Developer mode ← **Load unpacked** ← בוחרים את התיקייה (ומכבים את גרסת החנות). השדה `key` ב-manifest קובע לו תמיד את המזהה `cphfcojbhpemojgolhcgngodbfodildd`, וההרחבה ל-Claude Desktop מקבלת אותו ואת מזהה החנות `pihiihgmfgefkneahjhmeamnmlfapmfp` בלי שום הגדרה. אותו דבר כשטוענים ישירות את התיקייה `extension/` מהריפו. הקובץ `wa-reader-<version>.zip` (בלי `key`) הוא זה שמעלים לחנות.

**Release.** מריצים את ה-workflow ‏Release (או דוחפים תגית `v*`). הוא מריץ את הבדיקות, בונה את ה-`.mcpb` ואת שני קובצי ה-ZIP, ומפרסם אותם ב-GitHub Releases.

## חשוב לדעת

התוסף לא קשור ל-WhatsApp, ל-Meta או ל-Anthropic ולא מאושר על ידן. הוא קורא נתונים מתוך WhatsApp Web בדרך לא רשמית, ועדכונים של WhatsApp עלולים לשבור אותו זמנית. השימוש באחריותכם. משתמש בספרייה [WA-JS](https://github.com/wppconnect-team/wa-js) (Apache 2.0). הקוד ברישיון MIT.

## מי בנה את זה

<a href="https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader"><img src="docs/eitan-mark.svg" width="56" align="right" alt="איתן | דיגיטציה ארגונית"></a>

נבנה על ידי **[איתן | דיגיטציה ארגונית](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader)**, קובי איתן.
אני בונה לעסקים מערכות, אוטומציות וסוכני AI שחוסכים עבודה ידנית. [לשיחת ייעוץ ראשונית חינם](https://digital.m-eitan.co.il/?utm_source=github&utm_medium=readme&utm_campaign=wa-reader#contact)
