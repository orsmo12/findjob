"""בדיקת חקירה: מבנה הלוחות. קריאה בלבד."""
import re, json, httpx
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124", "Accept": "application/json,text/html"}
cx = httpx.Client(timeout=20, follow_redirects=True, headers=UA)
def comeet(u):
    t = cx.get(u).text
    m = re.search(r"COMPANY_POSITIONS_DATA\s*=\s*(\[.*?\]);", t, re.S)
    print("\n", u, len(t), "var" if m else "novar", re.findall(r"(COMPANY_[A-Z_]+)\s*=", t)[:8])
    if m:
        d = json.loads(m.group(1)); print(" n=", len(d))
        if d:
            p = d[0]; print(" sample:", json.dumps({k: p.get(k) for k in ("name","location","url_comeet_hosted_page","experience_level","custom_fields","time_updated")}, ensure_ascii=False)[:1500])
            pg = cx.get(p["url_comeet_hosted_page"]).text
            mm = re.search(r"POSITION_DATA\s*=\s*(\{.*?\});", pg, re.S)
            print(" position page vars:", re.findall(r"([A-Z_]{6,})\s*=", pg)[:8], "desc-in-page:", bool(mm))
            if mm:
                pd = json.loads(mm.group(1)); print(" pos keys:", list(pd.keys())[:25]); print(" details:", str(pd.get("details") or pd.get("custom_fields"))[:600])
for u in ["https://www.comeet.com/jobs/tripleten/98.008", "https://www.comeet.com/jobs/fiverr/60.002", "https://www.comeet.com/jobs/hibob/12.00A", "https://www.comeet.com/jobs/monday/41.00B"]:
    try: comeet(u)
    except Exception as e: print(u, "err", e)
for tenant, wd, site in [("nvidia", "wd5", "NVIDIAExternalCareerSite"), ("intel", "wd1", "External")]:
    u = f"https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    try:
        r = cx.post(u, json={"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "Israel student"})
        d = r.json(); print("\nworkday", tenant, r.status_code, d.get("total"), [ (j.get("title"), j.get("locationsText"), j.get("externalPath")) for j in d.get("jobPostings", [])[:4]])
        if d.get("jobPostings"):
            jp = d["jobPostings"][0]["externalPath"]
            r2 = cx.get(f"https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}{jp}")
            jd = r2.json().get("jobPostingInfo", {}); print(" detail keys:", list(jd.keys())[:15], len(jd.get("jobDescription", "")))
    except Exception as e: print("workday err", tenant, e)
for u in ["https://elbitsystemscareer.com", "https://elbitsystemscareer.com/jobs", "https://careers.checkpoint.com", "https://www.wix.com/jobs/locations/tel-aviv", "https://careers.wix.com", "https://www.cyberark.com/careers/all-job-openings/"]:
    try:
        r = cx.get(u); t = r.text
        print("\n", u, r.status_code, len(t), "links:", sorted(set(re.findall(r"(comeet|greenhouse|lever\.co|ashbyhq|smartrecruiters|myworkdayjobs|successfactors|taleo|icims|jobvite|workable)", t, re.I)))[:8], re.findall(r'api[^"\']{0,80}job[^"\']{0,60}', t)[:3])
    except Exception as e: print(u, "err", e)
