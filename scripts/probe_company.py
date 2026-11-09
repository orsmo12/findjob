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
            print("   ids:", sorted(set(re.findall(r"\b[0-9A-F]{2}\.[0-9A-F]{3}\b", page)))[:15])
        print("-- discover():", A.discover(cx, name))


if __name__ == "__main__":
    main(" ".join(sys.argv[1:]) or "Hailo")
