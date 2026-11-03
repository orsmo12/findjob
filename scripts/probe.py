"""בדיקת חקירה: איפה כל חברה מפרסמת משרות. קריאה בלבד. רץ ב-GitHub Actions."""
import re, sys, json, httpx
from ddgs import DDGS
names = sys.argv[1:] or ["monday.com", "Wix", "Check Point", "Elbit Systems", "CyberArk", "Wiz", "NVIDIA", "Intel", "Fiverr", "Mobileye", "Rafael", "Israel Aerospace Industries", "Applied Materials", "Melio", "HiBob"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124"}
cx = httpx.Client(timeout=12, follow_redirects=True, headers=UA)
PAT = re.compile(r"https?://[^\s\"'<>]*(comeet\.(?:com|co)/jobs/[^\s\"'<>/]+/[0-9A-F.]+|myworkdayjobs\.com[^\s\"'<>]*|smartrecruiters\.com/[^\s\"'<>/]+|greenhouse\.io/[^\s\"'<>/]+|lever\.co/[^\s\"'<>/]+|ashbyhq\.com/[^\s\"'<>/]+)", re.I)
for n in names:
    hits = set()
    for q in (f"{n} careers jobs Israel", f"{n} comeet jobs", f"{n} myworkdayjobs"):
        try:
            for r in DDGS().text(q, max_results=8) or []:
                for m in PAT.finditer(r.get("href", "") + " " + r.get("body", "")):
                    hits.add(m.group(0)[:120])
        except Exception as e:
            print("ddgs err", type(e).__name__)
    print(f"\n== {n}: {sorted(hits)[:8]}")
    for h in sorted(hits)[:2]:
        if "comeet" in h:
            try:
                t = cx.get(h).text
                m = re.search(r"COMPANY_POSITIONS_DATA\s*=\s*(\[.*?\]);", t, re.S)
                print("  comeet page", len(t), "positions json:", bool(m), (len(json.loads(m.group(1))) if m else ""), "keys:", (list(json.loads(m.group(1))[0].keys())[:20] if m and json.loads(m.group(1)) else ""))
                if not m:
                    print("  vars:", re.findall(r"var\s+([A-Z_]{5,})\s*=", t)[:10])
            except Exception as e:
                print("  fetch err", e)
