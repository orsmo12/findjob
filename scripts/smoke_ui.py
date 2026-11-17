"""בדיקת עשן לאפליקציה הבנויה: כל המסכים וכל הלשוניות של חלון משרה נפתחים בלי שגיאה, גם עם משרה שמורה.
שימוש: python3 scripts/smoke_ui.py web/index.html   (או קובץ שנבנה עם build.py --cloud)
נוצרה אחרי 16.11: מסך ההגשות היה ריק רק כשהייתה משרה שמורה, ואף בדיקה לא פתחה אותו."""
import asyncio, sys, os
from playwright.async_api import async_playwright

CHECK = r"""()=>{const out=[];const ok=(n,f)=>{try{f();out.push([n,'ok'])}catch(e){out.push([n,e.message])}};
  ok('seed',()=>{document.querySelectorAll('.splash,#splash').forEach(x=>x.remove());
    setFeed({stats:{},jobs:[{id:'j1',title:'QA Automation Engineer',co:'Acme',loc:'Tel Aviv',fit:4.3,url:'https://example.com',reasons:['x'],gaps:['y'],
      dims:{req:[['Python',1],['CI/CD',0]],skills:'1/2'},tailor:{v:2,edits:[{before:'a',after:'b',why:'c'}]},letter:{text:'Dear Acme team,\n\nHello',v:6}}]});
    S.apps=[{id:'a-j1',jobId:'j1',status:'saved',date:new Date().toISOString(),letter:''},{id:'a-j2',jobId:'j1',status:'interview',date:new Date().toISOString(),when:new Date(Date.now()+864e5).toISOString()}];
    S.history=[{jobId:'zz',title:'Old',co:'Co',reason:'removed',date:new Date().toISOString()}]});
  for(const p of ['main','jobs','apps','prep','linkedin','profile','settings'])ok('page:'+p,()=>goPage(p));
  for(const g of ['open','progress','waiting','closed'])ok('apps:'+g,()=>{appGrp=g;renderApps()});
  for(const t of ['details','letter','ref'])ok('app:'+t,()=>{openApp('a-j1',t);if(document.getElementById('sheetBody').innerHTML.length<200)throw new Error('empty')});
  ok('job info',()=>openJobInfo('j1'));ok('kit help',()=>{openApp('a-j1','letter');kitHelp('cv','a-j1',document.querySelector('.kc-q'));if(!document.querySelector('.kc-bub'))throw Error('no bubble')});
  if(typeof openDev==='function')ok('dev tools',()=>{RUNS=[{created_at:new Date().toISOString(),stats:{usage_report:{rows:[{}],feedback:[{key:'k',name:'#1',at:'x',t:'y'}],funnel:[['a',1]],errors:[['e',1]]}}},{created_at:new Date().toISOString(),stats:{job:'n',failures:[{where:'w',user:'u',error:'e'}]}}];openDev()});ok('cv preview',()=>cvPreview('j1','a-j1'));
  return out}"""


async def main(path):
    async with async_playwright() as p:
        exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        bad = []
        for w in (390, 1440):
            pg = await b.new_page(viewport={"width": w, "height": 900})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("file://" + os.path.abspath(path))
            await pg.wait_for_timeout(1200)
            res = await pg.evaluate(CHECK)
            bad += [f"{w}px {n}: {r}" for n, r in res if r != "ok"]
            # שגיאות שקשורות לשרת האמיתי (אין רשת בבדיקה) לא נחשבות
            bad += [f"{w}px pageerror: {e}" for e in errs if not any(x in e for x in ("supabase", "fetch", "Failed to"))]
        await b.close()
    for x in bad:
        print("✗", x)
    print("smoke: " + ("הכל תקין ✓" if not bad else f"{len(bad)} תקלות ✗"))
    sys.exit(1 if bad else 0)

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "web/index.html"))
