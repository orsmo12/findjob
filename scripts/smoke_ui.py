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
  ok('job info',()=>openJobInfo('j1'));ok('know meter',()=>{goPage('profile');const t=document.querySelector('.know-h .num').textContent;if(!/^\d+%$/.test(t))throw Error('know '+t)});ok('kit help',()=>{openApp('a-j1','letter');kitHelp('cv','a-j1',document.querySelector('.kc-q'));if(!document.querySelector('.kc-bub'))throw Error('no bubble')});
  if(typeof openDev==='function')ok('dev tools',()=>{RUNS=[{created_at:new Date().toISOString(),stats:{usage_report:{rows:[{}],feedback:[{key:'k',name:'#1',at:'x',t:'y'}],funnel:[['a',1]],errors:[['e',1]]}}},{created_at:new Date().toISOString(),stats:{job:'n',failures:[{where:'w',user:'u',error:'e'}]}}];openDev()});ok('cv preview',()=>cvPreview('j1','a-j1'));
  return out}"""


LIGHT_IN_DARK = r"""async()=>{const out=new Set();const scan=()=>document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();
  if(r.width<60||r.height<24||!e.offsetParent||r.top>=innerHeight||r.bottom<=0||e.closest('.cv-page'))return;/* דף קורות החיים הוא נייר לבן בכוונה */const m=getComputedStyle(e).backgroundColor.match(/[\d.]+/g);if(!m)return;
  const [R,G,B,A=1]=m.map(Number);if(A>.4&&(R+G+B)/3>200)out.add(e.tagName.toLowerCase()+'.'+[...e.classList].join('.')+(e.classList.length?'':' in .'+[...(e.parentElement.classList)].join('.')+' "'+e.textContent.trim().slice(0,30)+'"'))});
  for(const pg of ['main','jobs','apps','profile','settings','linkedin']){try{closeSheet()}catch(e){}goPage(pg);await new Promise(r=>setTimeout(r,250));scan()}
  try{goPage('apps');openApp('a-j1','letter');await new Promise(r=>setTimeout(r,400));scan();openApp('a-j1','details');await new Promise(r=>setTimeout(r,300));scan()}catch(e){}
  try{closeSheet();openJobInfo('j1');await new Promise(r=>setTimeout(r,300));scan()}catch(e){}
  return [...out]}"""


async def main(path):
    async with async_playwright() as p:
        exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        bad = []
        for w, theme in ((390, "light"), (1440, "light"), (390, "dark")):
            pg = await b.new_page(viewport={"width": w, "height": 900})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("file://" + os.path.abspath(path))
            await pg.wait_for_timeout(1200)
            if theme == "dark":
                await pg.evaluate("setTheme('dark')")
            res = await pg.evaluate(CHECK)
            bad += [f"{w}px {theme} {n}: {r}" for n, r in res if r != "ok"]
            if theme == "dark":   # במצב כהה: אין משטח בהיר גדול (נשאר לבן מהעיצוב הבהיר)
                light = await pg.evaluate(LIGHT_IN_DARK)
                bad += [f"{w}px dark: משטח בהיר {x}" for x in light]
            # שגיאות שקשורות לשרת האמיתי (אין רשת בבדיקה) לא נחשבות
            bad += [f"{w}px pageerror: {e}" for e in errs if not any(x in e for x in ("supabase", "fetch", "Failed to"))]
        await b.close()
    for x in bad:
        print("✗", x)
    print("smoke: " + ("הכל תקין ✓" if not bad else f"{len(bad)} תקלות ✗"))
    sys.exit(1 if bad else 0)

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "web/index.html"))
