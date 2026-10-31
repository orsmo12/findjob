head=open('head.tpl').read()
css=open('office.css').read()+"\n"+open('app.css').read()
OM='''        <!-- agent messages: added below the workflow; the animation, agents row and workflow above are unchanged -->
        <section class="om-panel" aria-labelledby="omH"><div class="om-title"><span id="omH" style="font-weight:700;color:var(--fg)">הודעות מהסוכנים</span><span>החדשות למעלה</span></div><div id="omList"></div></section>
        '''
office=open('office.html').read().replace('<div class="off-car-wrap">',OM+'<div class="off-car-wrap">')
body=open('body.html').read().replace('<!--OFFICE_HTML-->',office).replace('<!--AGSHEET_HTML-->',open('agsheet.html').read())
import sys,json
# python build.py                       → findjob.html (דוגמאות)
# python build.py feed.json out.html     → משרות אמיתיות מקובץ
# python build.py --cloud URL KEY out    → הגרסה המאוחסנת, מחוברת ל-Supabase
cloud='--cloud' in sys.argv
if cloud:
    i=sys.argv.index('--cloud');url,key,out=sys.argv[i+1],sys.argv[i+2],sys.argv[i+3]
    feed='const CLOUD='+json.dumps({'url':url,'key':key})+';\n'
else:
    feed=('const FEED='+open(sys.argv[1]).read()+';\n') if len(sys.argv)>1 else ''
    out=sys.argv[2] if len(sys.argv)>2 else 'findjob.html'
js=feed+open('app1_head.js').read()+open('app1_tail.js').read()+"\n/* ═════════ OFFICE — copied verbatim from Life Building (unchanged) ═════════ */\n"+open('office.js').read()+"\n"+open('app2.js').read()+"\n"+open('app3.js').read()+"\n"+open('onb_q.js').read()+"\n"+open('plan.js').read()+"\n"+open('app4.js').read()+("\n"+open('cloud.js').read()+"\ncloudBoot();\n" if cloud else "\ninit();\n")
sb='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n' if cloud else ''
open(out,'w').write(head+css+"\n</style>\n"+sb+"</head>\n<body>\n"+body+"\n<script>\n"+js+"</script>\n</body>\n</html>\n")
