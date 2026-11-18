"""כלי מפתח: הרצת ניסיון למכתבים. כותב מכתבים למשרות שמורות של משתמש בשתי הדרכים (מכתב שלם / בחלקים),
בלי לשמור כלום, ומדפיס רק מדדים: 6 הכללים, סבבי תיקון, מילים, קודי "למה נכשל". בלי טקסט מכתבים (הריפו ציבורי).

  python scripts/letter_shadow.py <idx> [n]
"""
from __future__ import annotations
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db, handoffs as H  # noqa: E402
from agent_core.agents import letter_graph as LG  # noqa: E402
from scripts.insights import get  # noqa: E402


def main(idx: int, n: int = 3):
    u = sorted(db.auth_users(), key=lambda x: x.get("created_at") or "")[idx]
    p = (get("profiles", select="cv_text,name,first,answers,state", user_id=f"eq.{u['id']}") or [{}])[0]
    a, st = p.get("answers") or {}, p.get("state") or {}
    rows = [r for r in get("jobs", select="id,card,brief,created_at", user_id=f"eq.{u['id']}", decision="eq.save", order="created_at.desc", limit="30") or []
            if (r.get("card") or {}).get("ad")][:n]
    print(f"משתמש #{idx}: {len(rows)} משרות שמורות עם מודעה")
    tot = {}
    for mode in (False, True):
        LG.LETTER_PARTS, LG._graph = mode, None
        sc, why, rounds, words = Counter(), Counter(), Counter(), []
        for r in rows:
            job = r["card"]
            out = LG.write_letter_v4(H.cv_for(p.get("cv_text") or "", a, english=True), job, p.get("name") or p.get("first") or "",
                                     r.get("brief"), str(a.get("now") or "")[:400], [str(x) for x in st.get("my_letters") or []][:3], may_reuse=True)
            sc.update(k for k, v in (out.get("score") or {}).items() if v)
            why.update(c for c in LG.letter_why(out["text"], job) if c.startswith(("opening", "closing", "clean")))
            rounds[out.get("rounds") or 0] += 1
            words.append(len(out["text"].split()))
            print(f"  {'חלקים' if mode else 'שלם'} | {job.get('co', '')[:20]} | " + " ".join(f"{k}{'✓' if v else '✗'}" for k, v in (out.get("score") or {}).items())
                  + f" | סבבים {out.get('rounds')} | מילים {words[-1]}")
        tot[mode] = sc
        print(f"{'בחלקים' if mode else 'מכתב שלם'}: " + ", ".join(f"{k} {sc[k]}/{len(rows)}" for k in ("opening", "closing", "project", "military", "gap_honest", "clean"))
              + f" | סבבים {dict(rounds)} | למה נכשל {dict(why)}\n")


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 3)
