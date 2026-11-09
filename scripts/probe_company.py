"""
probe_company.py — כלי מפתח: למה חברה לא נמצאה? מריץ את הגילוי על שם אחד ומדפיס מה נמצא בכל שלב.
קריאה בלבד, בלי משתמשים ובלי AI.  python scripts/probe_company.py "Hailo"
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from agent_core.agents import ats as A

HINT = re.compile(r"comeet|greenhouse|lever\.co|ashbyhq|smartrecruiters|myworkdayjobs|workable|bamboohr|breezy|jobvite|icims|"
                  r"teamtailor|personio|recruitee|hibob|company[-_]?uid|careers-api|iframe", re.I)


def main(name: str) -> None:
    print(f"== {name}")
    with httpx.Client(timeout=15, follow_redirects=True, headers=A.UA) as cx:
        texts = []
        for q in (f'"{name}" comeet jobs', f'"{name}" careers myworkdayjobs', f'{name} careers jobs Israel', f"{name} careers"):
            got = A._search(q)
            print(f"-- search: {q} ({len(got)})")
            for t in got[:8]:
                print("   ", t[:160].replace("\n", " "))
            texts += got
        urls = list(dict.fromkeys(u for t in texts for u in re.findall(r"https?://[^\s\"'<>]+", t)))
        own = [u for u in urls if re.search(r"career|jobs", u, re.I)]
        print(f"-- career-like urls: {len(own)}")
        for u in own[:6]:
            host = re.sub(r"^https?://(www\.)?", "", u).split("/")[0]
            print(f"   {u}  same_company={A.same_company(name, host.split('.')[0])}")
        for u in own[:3]:
            try:
                r = cx.get(u)
            except httpx.HTTPError as e:
                print(f"-- fetch {u}: {type(e).__name__}"); continue
            page = r.text
            print(f"-- fetch {u}: {r.status_code}, {len(page)} chars, final {r.url}")
            for m in list(dict.fromkeys(m.group(0) for m in re.finditer(r".{0,90}(" + HINT.pattern + r").{0,120}", page, re.I)))[:25]:
                print("   >", m.replace("\n", " ")[:220])
            for s in re.findall(r"<script[^>]+src=[\"']([^\"']+)", page)[:30]:
                print("   script:", s[:160])
            if "comeet" in u:  # מה יש בדף של Comeet: נתוני משרות מוטמעים, טוקן, קריאות API
                for m in re.finditer(r"(COMPANY_[A-Z_]+\s*=|[\"']token[\"']|careers-api|positions\?)[^;\n]{0,160}", page):
                    print("   comeet>", m.group(0)[:200])
                print("   vars:", sorted(set(re.findall(r"(?:var|window\.|const|let)\s*([A-Za-z_][A-Za-z0-9_]{4,})\s*=", page)))[:60])
                for m in re.finditer(r".{0,80}(position|D5\.007|uid)[^\n]{0,120}", page, re.I):
                    if "newrelic" not in m.group(0).lower():
                        print("   pos>", m.group(0)[:200])
                print("   has COMPANY_POSITIONS_DATA:", "COMPANY_POSITIONS_DATA" in page, "| incapsula:", "Incapsula" in page)
            print("   site_links:", A.site_links(page, str(r.url))[:5])
            for m in re.finditer(r"<a[^>]+href=[\"'][^\"']*[0-9A-F]{2}\.[0-9A-F]{3}[^>]*>.{0,400}?</a>", page, re.S | re.I):
                print("   a>", re.sub(r"\s+", " ", m.group(0))[:400])
                break
            for i in sorted(set(re.findall(r"\b[0-9A-F]{2}\.[0-9A-F]{3}\b", page)))[1:3]:
                k = page.find(i)
                print(f"   ctx {i}>", re.sub(r"\s+", " ", page[max(0, k - 400):k + 300]))
            print("   ids:", sorted(set(re.findall(r"\b[0-9A-F]{2}\.[0-9A-F]{3}\b", page)))[:15])
        b = A.discover(cx, name)
        print("-- discover():", b)
        if b:
            items = A.read_board(cx, b, name, {"software", "engineer", "developer", "junior", "student", "intern", "graduate", "ai"})
            print(f"-- read_board: {None if items is None else len(items)} jobs in Israel")
            for j in (items or [])[:8]:
                print(f"   {j['title'][:60]} | {j['location'][:30]} | desc {len(j.get('description') or '')} | {j['url'][:90]}")


def probe_tg(ch: str) -> None:
    """tg:<ערוץ> — בודק שקריאת ערוץ טלגרם ציבורי עובדת (בלי AI)."""
    from agent_core.agents import telegram as T
    with httpx.Client(timeout=15, follow_redirects=True, headers=T.UA) as cx:
        r = cx.get(f"https://t.me/s/{ch}")
        print(f"== t.me/s/{ch}: {r.status_code}, {len(r.text)} chars, {r.text.count('tgme_widget_message_wrap')} posts on page")
        posts = T.parse(r.text, days=7)
        print(f"-- recent posts (7 days): {len(posts)}")
        for p in posts[-6:]:
            print("  ", p["at"][:16], p["post"], "|", p["text"][:110].replace("\n", " "), "| links:", p["links"][:2])


if __name__ == "__main__":
    arg = " ".join(sys.argv[1:]) or "Hailo"
    probe_tg(arg[3:]) if arg.startswith("tg:") else main(arg)
