"""
verify_companies.py — מאמת לכל חברה בקטלוג איפה היא מפרסמת משרות.

בודק בקריאה בלבד (GET ל-API ציבורי, בלי התחברות) את הלוחות של Greenhouse,
Lever ו-Ashby לפי ה-slugs המשוערים, ושומר בקטלוג רק מה שבאמת עונה.
מריצים מהמחשב, פעם בחודש:  python scripts/verify_companies.py
"""
import json, sys
from pathlib import Path
import httpx

CATALOG = Path(__file__).resolve().parents[1] / "data" / "companies.json"
BOARDS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "lever":      "https://api.lever.co/v0/postings/{slug}?mode=json&limit=1",
    "ashby":      "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}


def detect(slugs: list[str]) -> dict | None:
    with httpx.Client(timeout=10, follow_redirects=True, headers={"User-Agent": "findjob-verify/1.0"}) as cx:
        for slug in slugs:
            for ats, url in BOARDS.items():
                try:
                    r = cx.get(url.format(slug=slug))
                except httpx.HTTPError:
                    continue
                if r.status_code == 200 and r.text.strip()[:1] in "[{":
                    return {"ats": ats, "slug": slug}
    return None


def main() -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    found = 0
    for c in data["companies"]:
        hit = detect(c.get("slugs", []))
        c["ats"] = hit  # None = אין לוח ציבורי מוכר; דורון ימצא את המשרות שלה בחיפוש הפתוח
        found += bool(hit)
        print(f"{'✓' if hit else '·'} {c['name']:<16} {hit or 'חיפוש פתוח בלבד'}")
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{found}/{len(data['companies'])} חברות עם לוח ציבורי מאומת")


if __name__ == "__main__":
    sys.exit(main())
