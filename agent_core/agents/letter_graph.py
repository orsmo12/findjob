"""
letter_graph.py — מכתבים v4: שי כותב מכתב פנייה בלולאת LangGraph.

  מה החברה צריכה (המודעה + הסקירה של גיל)  →  בחירת פרויקטים מקורות החיים  →  טיוטה
      →  ביקורת עצמית מול רף האיכות (גנרי? מותאם? ניסוחי AI?)  →  שכתוב (עד 2 פעמים)
      →  בדיקת אמת בקוד: כל שם ומספר חייבים להופיע אצל המשתמש או במודעה. נכשל → שכתוב, ובסוף מחיקת המשפט.

רף האיכות נלמד מהמכתבים שאור אהב: פתיחה ישירה (תפקיד, מיקום, מצב לימודים), פרויקט מרכזי במונחים של המשרה,
כל יכולת מחוברת לדרישה במודעה ולתחום של החברה, כנות לגבי פער עם הוכחת למידה, ניסיון קודם שמחובר למה שהמשרה מבקשת,
סגירה עם הצוות והמיקום, בלי קלישאות. העובדות תמיד של המשתמש עצמו. מכתבים שהמשתמש העלה הם המקור לסגנון שלו,
ומותר להשתמש בפסקאות מהם כשהן נכונות.

אם LangGraph לא מותקן, write_letter_v4 נופל בחזרה למכתב v3 (letters.write_letter).
"""
from __future__ import annotations
import json
import re
from typing import TypedDict

from agent_core.llm_router import chat
from agent_core import activity as act
from agent_core.agents.letters import ad_language, unsupported, _drop_bad_sentences, write_letter, shape_letter

MAX_ROUNDS = 2

# ניסוחים שמסגירים מכתב שנכתב ב-AI (ברוח unslop) וקלישאות של מכתבי פנייה
SLOP = ["express my strong interest", "i am writing to", "i am excited to apply", "aligns perfectly", "aligns directly",
        "passionate", "dynamic", "solid foundation", "great fit", "thank you for your time and consideration",
        "leverage", "synergy", "cutting-edge", "fast-paced", "i am confident that", "delve", "tapestry", "testament to",
        "in today's", "game-changer", "seamlessly", "robust", "spearheaded", "hit the ground running", "extreme ownership",
        "directly mirror", "mirroring", "mirrors the", "akin to", "just like",
        "בתשוקה", "אני כותב כדי", "אשמח להביע", "מתאים בדיוק"]

QUALITY = """What an excellent letter does (the quality bar):
1. Opening: in one sentence, the role, the location, and the candidate's current status (from CURRENT STATUS if given).
2. The main project, described in the job's own terms: what it does that this job also needs.
3. Every skill mentioned is tied to a requirement in the ad, and where possible to the company's domain (from the company brief).
4. If an important requirement is missing from the CV, say so honestly in one short sentence, then show fast self-learning with a real example from the CV.
5. Earlier experience (military, work, studies) only if linked to something the job asks for.
6. Closing: the specific team and location. No generic thanks.
7. 120-190 words, plain and specific. No clichés, no AI phrasing, no lists.
8. Honest links only: say a project is relevant to a requirement and why. Never claim it mirrors, equals or is
   similar to something it is not (tests in a web app are not chip verification; a hobby robot is not hardware bring-up).
9. Layout of a real letter: greeting line, then 3-4 short paragraphs separated by a blank line
   (opening / main project / second project or honest gap + self-learning + earlier experience / closing),
   then "Best regards," and the full name on its own line."""


RESERVE = re.compile(r"reserv|מילואים", re.I)
RESERVE_NOTE = ("RESERVE DUTY (written in the CV or status): add one sentence, as in the examples: long periods of reserve duty meant "
                "completing most of the degree through self-study, so the candidate learns new tools quickly and independently. "
                "Put it right after the honest gap if there is one.")

# 6 הכללים מהמכתבים שאור אהב (claude/findjob-letter-examples.md). העורך בודק רק אותם.
RULES = ["Opening: the role, the location and the candidate's current status (degree) in the first paragraph",
         "The main project described in the job's own terms, tied to requirements in the ad",
         "Honest about a missing important requirement (if there is one), followed by self-learning proof",
         "Military or earlier experience linked to something the job asks for (only if the CV has it)",
         "Closing names the team or company and the location",
         "No clichés or AI phrasing, 120-190 words, 3-4 short paragraphs"]


class S(TypedDict, total=False):
    cv: str; job: dict; name: str; brief: dict; status: str; own_letters: list[str]; may_reuse: bool
    lang: str; need: dict; text: str; issues: list[str]; rounds: int; bad: list[str]; checked: bool


def _j(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        return json.loads(m.group(0)) if m else {}
    except ValueError:
        return {}


def _ad(st: S) -> str:
    return st["job"].get("ad") or st["job"].get("desc") or ""


def _brief_text(b: dict | None) -> str:
    if not b or not b.get("found"):
        return "(none)"
    return " ".join([b.get("what") or ""] + [f.get("text", "") for f in b.get("facts") or []])[:1200]


# ── צמתים ────────────────────────────────────────────────────────────────────
def need(st: S) -> dict:
    """מה החברה צריכה, ואיזה פרויקטים מקורות החיים עונים על זה."""
    j = st["job"]
    d = _j(chat("assistant", "letter_need", [{"role": "user", "content": f"""Read the job ad, the company brief and the CV.
Return JSON only: {{"requirements": [the 3-4 most important requirements in the ad, short],
 "domain": "what the company works on, in a few words, only from the ad or brief",
 "projects": [project names EXACTLY as written in the CV: the ONE project that answers the most requirements first;
   add a second ONLY if it answers an important requirement the first does not (max 2)],
 "covers": {{"<project>": [the requirements it answers]}},
 "gaps": [important requirements the CV does not show, max 2]}}

JOB: {j['title']} at {j['co']}
AD:
{_ad(st)[:3000]}
COMPANY BRIEF: {_brief_text(st.get('brief'))}
CV:
{st['cv'][:4500]}"""}], tier="judge", max_tokens=700))
    cvl = st["cv"].lower()
    d["projects"] = [p for p in d.get("projects") or [] if isinstance(p, str) and p.lower() in cvl][:2]   # רק פרויקטים שבאמת בקורות החיים
    d["reserve"] = bool(RESERVE.search(st["cv"] + " " + (st.get("status") or "")))   # מילואים: רק אם כתוב אצל המשתמש
    act.log("assistant", f"{j['co']}: החברה מחפשת {', '.join((d.get('requirements') or [])[:3]) or 'לא ברור מהמודעה'}. "
            + (f"הפרויקטים שהכי עונים: {', '.join(d['projects'])}." if d["projects"] else "לא מצאתי פרויקט שעונה ישירות."))
    return {"need": d, "lang": ad_language(_ad(st)) if _ad(st) else "English", "rounds": 0}


def _style_block(st: S) -> str:
    own = [x for x in st.get("own_letters") or [] if len(x) > 200][:3]
    if not own:
        return ""
    head = ("THE CANDIDATE'S OWN PAST LETTERS (their voice and style; you MAY reuse sentences or paragraphs from them "
            "when they are still true and fit this job):" if st.get("may_reuse") else
            "THE CANDIDATE'S OWN PAST LETTERS (match their voice and style; reuse a sentence only if it is still true):")
    return head + "\n" + "\n---\n".join(x[:1800] for x in own)


def draft(st: S) -> dict:
    j, n = st["job"], st.get("need") or {}
    text = chat("assistant", "letter_draft", [{"role": "user", "content": f"""Write a cover letter in {st['lang']} for this job.
{QUALITY}

Use ONLY facts from the CV and CURRENT STATUS. Never invent numbers, employers, grades, dates or technologies.
Greeting: "Dear {j['co']} team," (English) or "שלום לצוות {j['co']}," (Hebrew). End with "Best regards," and the name {st.get('name') or ''}.
Output only the letter.

WHAT THE COMPANY NEEDS: {', '.join(n.get('requirements') or []) or '(see ad)'}
COMPANY DOMAIN: {n.get('domain') or '(see ad)'}
PROJECTS TO FEATURE: {', '.join(n.get('projects') or []) or '(choose from the CV)'}
GAPS TO ADDRESS HONESTLY: {', '.join(n.get('gaps') or []) or 'none'}
{RESERVE_NOTE if n.get('reserve') else ''}
CURRENT STATUS: {st.get('status') or '(not given; use the CV)'}
{_style_block(st)}

JOB: {j['title']} at {j['co']} ({j.get('loc') or ''})
AD:
{_ad(st)[:3000]}
CV:
{st['cv'][:4500]}"""}], tier="write", max_tokens=1600)
    return {"text": text.strip()}


def letter_score(text: str, job: dict, cv: str = "", projects: list | None = None) -> dict:
    """בדיקה בקוד (בלי AI) של 6 הכללים, לכלי הפיתוח. מחזיר כלל → עובר/לא."""
    t, paras = (text or "").lower(), [p for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    first = (paras[1] if len(paras) > 2 else paras[0]).lower() if paras else ""
    last = " ".join(paras[-2:]).lower() if paras else ""
    title_w = [w for w in re.findall(r"[a-z]{3,}", (job.get("title") or "").lower())][:3]
    loc = re.split(r"[,·|-]", job.get("loc") or "")[0].strip().lower()
    mil = bool(re.search(r"\bidf\b|military|army|צה\"?ל|reserv|מילואים", cv or "", re.I))
    return {"opening": any(w in first for w in title_w) and bool(re.search(r"b\.?sc|degree|graduat|student|תואר", first)),
            "project": any((p or "").lower() in t for p in projects or []) if projects else bool(re.search(r"project|פרויקט", t)),
            "gap_honest": bool(re.search(r"haven.t|have not|not yet|yet to|עוד לא|טרם", t)),
            "military": (not mil) or bool(re.search(r"\bidf\b|military|army|reserve|officer|צה\"?ל|מילואים", t)),
            "closing": (job.get("co") or "").lower()[:12] in last or (bool(loc) and loc in last),
            "clean": not slop_in(text or "") and 110 <= len((text or "").split()) <= 200}


def slop_in(text: str) -> list[str]:
    t = text.lower()
    return [p for p in SLOP if p in t]


def critique(st: S) -> dict:
    """ביקורת עצמית מול רף האיכות. ניסוחי AI נבדקים בקוד, השאר במודל."""
    text, issues = st["text"], [f'remove the phrase "{p}"' for p in slop_in(st["text"])]
    words = len(text.split())
    if words > 210:
        issues.append(f"too long ({words} words), cut to under 190")
    rules = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(RULES))
    d = _j(chat("assistant", "letter_critique", [{"role": "user", "content": f"""You are a strict editor. Check this cover letter ONLY against these 6 rules:
{rules}
Return JSON only: {{"fail": [numbers of rules that clearly fail], "issues": [one concrete fix per failed rule]}}.
If every rule passes, return {{"fail": [], "issues": []}}. Do not suggest anything outside the 6 rules (no style polishing).
Rule 3 passes when the CV covers the important requirements. Rule 4 passes when the CV has no military or earlier experience.

JOB: {st['job']['title']} at {st['job']['co']} ({st['job'].get('loc') or ''})
AD (short): {_ad(st)[:1200]}
LETTER:
{text}"""}], tier="judge", max_tokens=400))
    if not d.get("fail"):
        d["issues"] = []
    issues += [str(x)[:200] for x in (d.get("issues") or [])[:4]]
    if issues:
        act.log("assistant", f"ביקורת על המכתב ל-{st['job']['co']}: {len(issues)} דברים לתקן ({issues[0][:60]}…)")
    return {"issues": issues}


def rewrite(st: S) -> dict:
    fix = list(st.get("issues") or [])
    if st.get("bad"):
        fix.append(f"remove anything not in the CV or the ad: {', '.join(st['bad'])}")
    text = chat("assistant", "letter_rewrite", [{"role": "user", "content": f"""Rewrite this cover letter, fixing exactly these points, keeping all true facts, the greeting, the paragraph breaks and the sign-off:
- {chr(10).join('- ' + f for f in fix)[2:]}
{QUALITY}
Use ONLY facts from the CV and CURRENT STATUS. Output only the letter.

CURRENT STATUS: {st.get('status') or '(not given)'}
CV:
{st['cv'][:4500]}
AD:
{_ad(st)[:2500]}
LETTER:
{st['text']}"""}], tier="write", max_tokens=1600)
    return {"text": text.strip(), "rounds": (st.get("rounds") or 0) + 1, "issues": [], "bad": []}


def ground(st: S) -> dict:
    src_extra = " ".join([_ad(st), st["job"]["title"], st.get("status") or "", _brief_text(st.get("brief"))])
    bad = unsupported(st["text"], st["cv"], src_extra, st["job"]["co"], st.get("name") or "")
    if bad:
        act.log("assistant", f"בבדיקת אמת: {', '.join(bad[:3])} לא מופיעים אצלך או במודעה.")
    return {"bad": bad}


def finalize(st: S) -> dict:
    text = st["text"]
    if st.get("bad"):
        act.log("assistant", "עדיין היו פרטים לא מבוססים. מחקתי את המשפטים האלה.")
        text = _drop_bad_sentences(text, st["bad"])
    text = shape_letter(text, st["job"]["co"], st.get("name") or "", st.get("lang") or "English")
    src_extra = " ".join([_ad(st), st["job"]["title"], st.get("status") or "", _brief_text(st.get("brief"))])
    return {"text": text, "checked": not unsupported(text, st["cv"], src_extra, st["job"]["co"], st.get("name") or "")}


# ── הגרף ───────────────────────────────────────────────────────────────────
def after_critique(st: S) -> str:
    return "rewrite" if st.get("issues") and (st.get("rounds") or 0) < MAX_ROUNDS else "ground"


def after_ground(st: S) -> str:
    return "rewrite" if st.get("bad") and (st.get("rounds") or 0) < MAX_ROUNDS else "finalize"


def build():
    from langgraph.graph import StateGraph, END
    g = StateGraph(S)
    for n, f in (("need", need), ("draft", draft), ("critique", critique), ("rewrite", rewrite), ("ground", ground), ("finalize", finalize)):
        g.add_node(n, f)
    g.set_entry_point("need")
    g.add_edge("need", "draft")
    g.add_edge("draft", "critique")
    g.add_conditional_edges("critique", after_critique, {"rewrite": "rewrite", "ground": "ground"})
    g.add_edge("rewrite", "critique")
    g.add_conditional_edges("ground", after_ground, {"rewrite": "rewrite", "finalize": "finalize"})
    g.add_edge("finalize", END)
    return g.compile()


_graph = None


def write_letter_v4(cv: str, job: dict, name: str, brief: dict | None = None, status: str = "",
                    own_letters: list[str] | None = None, may_reuse: bool = False) -> dict:
    global _graph
    try:
        if _graph is None:
            _graph = build()
    except ImportError:
        return write_letter(cv, job, name)
    act.log("assistant", f"כותב מכתב ל-{job['co']}: מה החברה צריכה, אילו פרויקטים מתאימים, טיוטה, ביקורת ובדיקת אמת")
    out = _graph.invoke({"cv": cv, "job": job, "name": name, "brief": brief or {}, "status": status,
                         "own_letters": own_letters or [], "may_reuse": may_reuse}, {"recursion_limit": 25})
    pr = (out.get("need") or {}).get("projects") or []
    return {"text": out["text"], "lang": out.get("lang") or "English", "v": 6, "checked": bool(out.get("checked")),
            "rounds": out.get("rounds") or 0, "projects": pr, "score": letter_score(out["text"], job, cv, pr)}
