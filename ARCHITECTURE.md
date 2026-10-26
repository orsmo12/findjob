# Life Board — Architecture & Developer Guide

> **מסמך חי** — מתעדכן עם כל שינוי במערכת.
> נכון ל: אוקטובר 2026

---

## תמונה כללית

Life Board היא פלטפורמה לניהול קריירה שמשלבת:
- **Next.js** (TypeScript) — ממשק משתמש
- **Python + LangGraph** — שכבת סוכנים חכמים
- **Groq API** — מודל שפה חינמי (qwen3.8-27b)
- **JobSpy** — scraping מ-LinkedIn, Indeed, Glassdoor בו-זמנית

```
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│         (TypeScript / React)            │
│   localhost:3000                        │
└──────────────┬──────────────────────────┘
               │ HTTP POST /career/search
               ↓
┌─────────────────────────────────────────┐
│         FastAPI Server (Python)         │
│   agent_core/api.py                     │
│   localhost:8001                        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│         LangGraph Career Graph          │
│   agent_core/graph.py                   │
│                                         │
│  [Job Finder] → [Scout] → [Mentor]      │
│       ↑              ↓                  │
│  [Refine Query] ←────┘                  │
│  (if < 3 matches)                       │
└─────────────────────────────────────────┘
```

---

## קבצים ותפקידים

```
lifeboard/
├── agent_core/              ← כל שכבת ה-Python
│   ├── __init__.py
│   ├── state.py             ← CareerState — הלוח המשותף של כל הסוכנים
│   ├── graph.py             ← מבנה הגרף + לוגיקת ניתוב
│   ├── api.py               ← FastAPI server (גשר ל-Next.js)
│   ├── run_test.py          ← סקריפט בדיקה ישיר (ללא server)
│   └── agents/
│       ├── job_finder.py    ← מחפש משרות + מחשב ATS score
│       ├── linkedin_scout.py ← מנתח חברות עם LLM
│       └── mentor.py        ← מזהה skill gaps עם LLM
├── .env                     ← GROQ_API_KEY (לא עולה ל-Git!)
├── .env.example             ← תבנית ל-.env
└── ARCHITECTURE.md          ← המסמך הזה
```

---

## LangGraph — איך זה עובד

### State — הלוח המשותף
כל הסוכנים קוראים מ-**CareerState** וכותבים אליו:
```python
class CareerState(TypedDict):
    search_query: str          # שאילתת החיפוש
    resume_text: str           # קורות החיים של המשתמש
    raw_jobs: List[JobResult]  # כל המשרות שנמצאו
    filtered_jobs: List[...]   # משרות עם ATS >= 35
    company_signals: List[...] # מודיעין חברות (Scout)
    skill_gaps: List[...]      # פערי מיומנויות (Mentor)
    iteration: int             # כמה סבבי חיפוש עברו
    should_refine: bool        # האם לחפש שוב עם שאילתה אחרת
```

### זרימת הגרף
```
[START]
   ↓
job_finder
   ↓
should_refine_or_continue()  ← פונקציית החלטה
   ├─ "refine" → refine_query → job_finder (לולאה, מקסימום 3×)
   └─ "scout"  → linkedin_scout → mentor → [END]
```

### למה LangGraph ולא קוד רגיל?
קוד רגיל = רצף קבוע. LangGraph = גרף דינמי.

| קוד רגיל | LangGraph |
|----------|-----------|
| if/else קשיח בתוך הקוד | conditional edges שניתן לשנות בלי לגעת בסוכנים |
| קשה להוסיף סוכן חדש | `graph.add_node("new_agent", fn)` + קשת אחת |
| כל הלוגיקה במקום אחד | כל סוכן עצמאי, אחראי על תחומו |
| לא ניתן ללולאה | loop טבעי ע"י חזרה לnode קודם |

---

## הסוכנים בפירוט

### 1. Job Finder (`agents/job_finder.py`)
**מה הוא עושה:** מחפש משרות אמיתיות ומחשב ATS score לכל אחת.

**כלים:** JobSpy (scraping), keyword matching
**קלט:** search_query, location, resume_text
**פלט:** raw_jobs, filtered_jobs, should_refine

**ATS Score** = כמה מילות מפתח מהResume מופיעות ב-Job Description.
- >= 35% → "match טוב"
- < 3 matches → מדליק should_refine

**מקורות חיפוש:** LinkedIn, Indeed, Glassdoor, Google Jobs (בו-זמנית)

---

### 2. LinkedIn Scout (`agents/linkedin_scout.py`)
**מה הוא עושה:** לוקח את החברות שנמצאו ומנתח אותן עם LLM.

**כלים:** Groq API (qwen3.8-27b)
**קלט:** filtered_jobs, raw_jobs, resume_text
**פלט:** company_signals

**לכל חברה מחזיר:**
- `company_stage`: startup / scaleup / enterprise
- `junior_friendly`: האם מתאים לג'וניור
- `fit_score`: 0-100
- `apply_priority`: high / medium / low
- `culture_signal`: תיאור תרבות החברה מתוך המשרה

---

### 3. Mentor (`agents/mentor.py`)
**מה הוא עושה:** מנתח את הפער בין קורות החיים לדרישות המשרות.

**כלים:** Groq API (qwen3.8-27b)
**קלט:** filtered_jobs, resume_text
**פלט:** skill_gaps

**לכל פער מיומנות מחזיר:**
- `skill`: שם המיומנות
- `reason`: למה היא חשובה לתפקידים אלה
- `priority`: high / medium / low

---

## FastAPI — גשר ל-Next.js

### הפעלה
```bash
cd lifeboard/
uvicorn agent_core.api:app --reload --port 8001
```

### endpoint ראשי
```
POST http://localhost:8001/career/search

Body:
{
  "query": "Python Developer",
  "location": "Tel Aviv",
  "resume": "טקסט קורות חיים...",
  "max_results": 8
}

Response:
{
  "rounds": 2,
  "total_jobs": 24,
  "matched_jobs": 6,
  "top_matches": [...],
  "company_signals": [...],
  "skill_gaps": [...],
  "advice": "..."
}
```

### שימוש מ-Next.js
```typescript
const response = await fetch("http://localhost:8001/career/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: searchQuery,
    location: "Tel Aviv",
    resume: userResume,
  }),
});
const data = await response.json();
```

---

## מודלים ועלויות

| מודל | מהירות | איכות | עלות |
|------|--------|-------|------|
| qwen/qwen3.8-27b | מהיר | טוב | חינם |
| openai/gpt-oss-120b | בינוני | מצוין | חינם |
| allam-2-7b | מהיר מאוד | בסיסי | חינם |

כרגע משתמשים ב-**qwen3.8-27b** — טוב מספיק ומהיר.

---

## מה הבא

### שלב הבא — Daily Assistant
סוכן שמכין **סיכום בוקר יומי**:
- 3 המשרות הכי חדשות שמתאימות לפרופיל
- תזכורות (ראיונות, מעקב אחר בקשות)
- טיפ יומי ל-skill gap הכי דחוף

### שלב עתידי — Scheduler
הפעלה אוטומטית כל בוקר ב-8:00:
```python
# ירוץ בלי שתפעיל ידנית
schedule.every().day.at("08:00").do(run_daily_summary)
```

### שלב עתידי — חיבור מלא ל-Next.js
- דף "חיפוש עבודה" ב-Life Board שמציג את תוצאות הסוכנים
- העלאת קורות חיים ישירות מהממשק
- היסטוריית חיפושים ב-PostgreSQL

---

## הרצה מהירה

```bash
# 1. הפעל את הסוכנים ישירות (בדיקה)
cd lifeboard/
python agent_core/run_test.py

# 2. הפעל את ה-API server
uvicorn agent_core.api:app --reload --port 8001

# 3. בדוק שה-API עובד
curl http://localhost:8001/health
```

---

## שגיאות נפוצות

| שגיאה | סיבה | פתרון |
|-------|------|-------|
| `ModuleNotFoundError: jobspy` | pip התקין לגרסת Python אחרת | הרץ `python -m pip install python-jobspy` |
| `GROQ_API_KEY not set` | חסר קובץ .env | צור `.env` עם `GROQ_API_KEY=...` |
| `model not found` | שם המודל השתנה | הרץ `python test_groq.py` לרשימה עדכנית |
| `ERROR: jobspy.linkedin: 429` | LinkedIn חסם את ה-IP | נורמלי, Indeed עובד תמיד |
