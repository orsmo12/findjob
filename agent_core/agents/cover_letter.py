"""
cover_letter.py — סוכן Cover Letter.

ברירת מחדל: Groq (חינם). Claude אופציונלי בלבד עם ENABLE_CLAUDE=1
איכותיים המותאמים אישית לכל משרה + CV.

למה Claude ולא Groq?
  - Cover Letter דורש כתיבה יצירתית ברמה גבוהה
  - Claude הרבה יותר טוב בעברית עסקית / אנגלית פורמלית
  - Claude Pro כבר בתשלום ($20/חודש) — $0 עלות נוספת
  - Groq ישמש לשאר: חיפוש, ניתוח, סיכום
"""

import os
import hashlib
import json
import re
from pathlib import Path
from typing import Optional

# ── Cache ──────────────────────────────────────────────────────────────────────
# שמירה מקומית של cover letters שנוצרו — כדי לא לבזבז tokens על אותה משרה פעמיים
CACHE_DIR = Path(__file__).parent.parent.parent / "memory" / "cover_letter_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_key(job_title: str, company: str, resume_hash: str) -> str:
    raw = f"{job_title.lower()}|{company.lower()}|{resume_hash}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _load_from_cache(key: str) -> Optional[str]:
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data.get("letter")
        except Exception:
            return None
    return None


def _save_to_cache(key: str, letter: str):
    path = CACHE_DIR / f"{key}.json"
    path.write_text(json.dumps({"letter": letter}, ensure_ascii=False), encoding="utf-8")


# ── Claude client ──────────────────────────────────────────────────────────────

def _get_client():
    try:
        import anthropic
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY לא מוגדר")
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        raise ImportError("anthropic package לא מותקן. הרץ: pip install anthropic")


def _write_with_claude(prompt: str, model: str = "claude-haiku-4-5") -> str:
    if os.environ.get("ENABLE_CLAUDE") != "1":
        raise RuntimeError("Claude כבוי (ENABLE_CLAUDE!=1) — משתמש ב-Groq החינמי")
    client = _get_client()
    message = client.messages.create(
        model=model,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()


# ── Prompt ─────────────────────────────────────────────────────────────────────

def _build_prompt(
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str,
    language: str = "he",
    tone: str = "professional",
) -> str:
    lang_instruction = "כתוב בעברית עסקית מעולה." if language == "he" else "Write in professional English."
    tone_map = {
        "professional": "מקצועי ורשמי" if language == "he" else "professional and formal",
        "friendly":     "ידידותי ועסקי" if language == "he" else "friendly yet professional",
        "confident":    "בטוח ודירקטי" if language == "he" else "confident and direct",
    }
    tone_label = tone_map.get(tone, tone_map["professional"])

    if language == "he":
        return f"""אתה מומחה לכתיבת מכתבי מוטיבציה לשוק ה-High-Tech הישראלי.

כתוב מכתב מוטיבציה מרשים עבור:
- תפקיד: {job_title}
- חברה: {company}
- טון: {tone_label}

תיאור המשרה:
{job_description[:1200]}

ה-CV של המועמד:
{resume_text[:1500]}

הוראות:
1. {lang_instruction}
2. פתח עם משפט פתיחה מושך שמזכיר את החברה והתפקיד
3. הדגש 2-3 הישגים קונקרטיים מה-CV שרלוונטיים למשרה
4. הסבר למה דווקא החברה הזו — הראה שעשית research
5. סיים עם call-to-action ברור
6. אורך: 3-4 פסקאות (לא יותר מ-350 מילים)
7. אל תשתמש בביטויים כמו "אני נרגש מאוד" — היה ספציפי ומקצועי

כתוב את המכתב כעת, ללא כותרות, רק הטקסט עצמו:"""
    else:
        return f"""You are an expert career writer specializing in tech industry cover letters.

Write a compelling cover letter for:
- Position: {job_title}
- Company: {company}
- Tone: {tone_label}

Job Description:
{job_description[:1200]}

Candidate's Resume:
{resume_text[:1500]}

Instructions:
1. {lang_instruction}
2. Open with a strong hook mentioning the company and role
3. Highlight 2-3 concrete achievements from the resume relevant to this job
4. Show genuine knowledge of the company
5. Close with a clear call-to-action
6. Length: 3-4 paragraphs (max 350 words)
7. Avoid clichés like "I'm excited" — be specific and professional

Write the letter now, no headers, just the text:"""


# ── Main function ──────────────────────────────────────────────────────────────

def generate_cover_letter(
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str,
    language: str = "he",
    tone: str = "professional",
    use_cache: bool = True,
    model: str = "claude-haiku-4-5",
) -> dict:
    """
    מחזיר:
      { "letter": str, "from_cache": bool, "tokens_used": int, "model": str }
    """
    resume_hash = hashlib.md5(resume_text.encode()).hexdigest()[:8]
    cache_key   = _cache_key(job_title, company, resume_hash)

    # בדוק cache קודם
    if use_cache:
        cached = _load_from_cache(cache_key)
        if cached:
            print(f"[Cover Letter] Cache hit: {company} / {job_title}")
            return {
                "letter":      cached,
                "from_cache":  True,
                "tokens_used": 0,
                "model":       model,
                "cache_key":   cache_key,
            }

    # בנה prompt וקרא ל-Claude
    prompt = _build_prompt(job_title, company, job_description, resume_text, language, tone)

    print(f"[Cover Letter] Generating for {company} / {job_title} (model: {model})")

    try:
        letter = _write_with_claude(prompt, model=model)
    except Exception as e:
        # Fallback: Groq אם Claude לא זמין
        print(f"[Cover Letter] Claude failed ({e}), falling back to Groq...")
        letter = _fallback_groq(prompt)

    # שמור לcache
    if use_cache:
        _save_to_cache(cache_key, letter)

    # הערכת tokens (approximation)
    tokens_used = len(prompt.split()) + len(letter.split())

    return {
        "letter":      letter,
        "from_cache":  False,
        "tokens_used": tokens_used,
        "model":       model,
        "cache_key":   cache_key,
    }


def _fallback_groq(prompt: str) -> str:
    """Fallback ל-Groq אם Claude לא זמין"""
    import os
    from groq import Groq
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    response = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1000,
    )
    return response.choices[0].message.content.strip()
