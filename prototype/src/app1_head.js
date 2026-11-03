document.documentElement.setAttribute('data-theme','light');

/* ═════════ helpers ═════════ */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// keep numeric ranges (18–21, ₪12–16K, 1–2) in reading order inside RTL text
const BIDI_RNG=/([₪$]?\d[\d.,]*K?\s*[–-]\s*[₪$]?\d[\d.,]*K?)/g;
const _esc=esc; window.escB=x=>_esc(x).replace(BIDI_RNG,'\u2066$1\u2069');
const LS={
  get(k,d){try{const v=localStorage.getItem('findjob_'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('findjob_'+k,JSON.stringify(v))}catch(e){}},
  clear(){try{Object.keys(localStorage).filter(k=>k.startsWith('findjob_')).forEach(k=>localStorage.removeItem(k))}catch(e){}}
};
const DAY=864e5;
const daysAgoISO=n=>new Date(Date.now()-n*DAY).toISOString();
const daysSince=iso=>Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/DAY));
const agoTxt=n=>n==null?'תאריך לא ידוע':n===0?'היום':n===1?'אתמול':n===2?'לפני יומיים':`לפני ${n} ימים`;
const IC={
  arrow:'<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  check:'✓'
};

/* ═════════ data — agents (single registry shared with the Office) ═════════ */
// index → Office character. key → backend node in agent_core.
const TEAM_DEFAULT=[
  {key:'strategist',name:'יואב',role:'יועץ אסטרטגי',state:'working',sched:'כל 12 שעות, לפני כל סריקה',
   desc:'קובע מה מחפשים, רק מקורות החיים והשאלון שלך: כותרות תפקיד, אזורים, רמת בכירות וחברות יעד. מתעדכן בכל שינוי בפרופיל.'},
  {key:'hunter',name:'דורון',role:'צייד משרות',state:'working',sched:'כל 12 שעות: 05:15 ו-17:15',
   desc:'אוסף משרות מ-LinkedIn (מודעות ציבוריות), Indeed ולוחות המשרות של חברות היעד. מסנן בכירות ומשרות שכבר ראית, ומדרג כל משרה מ-1 עד 5 מול הפרופיל שלך, עם סיבות ומה חסר. בכל סריקה בודק שהמשרות ששמרת עדיין פתוחות להגשה.'},
  {key:'researcher',name:'גיל',role:'חוקר חברות',state:'idle',sched:'כל שעתיים, למשרות ששמרת',
   desc:'מכין סקירה קצרה על כל חברה ששמרת, רק ממקורות ציבוריים ועם קישור לכל עובדה. מכין חיפושים מוכנים ב-LinkedIn לאנשים שיכולים להמליץ עליך.'},
  {key:'coach',name:'מאיה',role:'מאמנת ראיונות',state:'idle',sched:'כל שעתיים, למשרות ששמרת',
   desc:'מכינה שאלות הכנה לפי הדרישות שבמודעה, עם רמז איך לענות מתוך הניסיון שלך, ומטלות בית לדוגמה ממקורות ציבוריים עם פתרון מוצע. עוברת על פרופיל ה-LinkedIn שהעלית ומציעה שיפורים.'},
  {key:'linkedin',name:'קובי',role:'מנהל LinkedIn',state:'sleeping',sched:'כל 12 שעות',
   desc:'מוצא פוסטים ציבוריים מהשבוע על גיוס וקריירה, מכין שתי הצעות תגובה לכל אחד ומנסח טיוטת פוסט שבועית. אתה תמיד זה שמגיב ומפרסם.'},
  {key:'assistant',name:'שי',role:'עוזר אישי',state:'working',sched:'כל שעתיים, ובצ׳אט בכל רגע',
   desc:'כותב מכתב פנייה לכל משרה ששמרת, רק מתוך קורות החיים, מזכיר מתי לשלוח הודעת המשך, וזמין לשאלות ולתרגול ראיונות בצ׳אט.'},
];
// index → Office character (palette/desk). key → backend agent in agent_core.
const CAREER={id:'career',icon:'💼',lbl:'קריירה',color:'#0F8A64',lt:'#E6F4EE',desc:'חיפוש עבודה',prog:72,workflow:[],
  agents:TEAM_DEFAULT.map(a=>({...a}))};
const AG=key=>CAREER.agents.find(a=>a.key===key)||CAREER.agents[0];
const N=key=>AG(key).name;
function buildWorkflow(){
  const n=k=>N(k);
  if(typeof CLOUDM!=='undefined'&&CLOUDM&&window.__runsReady){CAREER.workflow=realWorkflow(n);return}
  CAREER.workflow=[
    {cmd:`${n('hunter')}.חיפוש לילה`,out:'41 משרות נאספו · 6 עברו את הסף · 3 סוננו כבכירות מדי',tag:'הושלם',state:'idle'},
    {cmd:`${n('researcher')}.מחקר`,out:'Mobileye: תקציר חברה וממליצים אפשריים',tag:'עובד',state:'working'},
    {cmd:`${n('assistant')}.מכתב`,out:'מכתב פנייה ל-Mobileye, לפי קורות החיים בלבד',tag:'ממתין',state:'idle'},
    {cmd:`${n('coach')}.הכנה`,out:'ראיון ב-Monday.com: 5 שאלות ומבנה תשובה',tag:'הושלם',state:'idle'},
    {cmd:`${n('linkedin')}.רדאר`,out:'3 פוסטים רלוונטיים מהיומיים האחרונים',tag:'עובד',state:'working'},
    {cmd:`${n('strategist')}.תכנון`,out:'יעד השבוע: 5 הגשות טובות · 5 תגובות · פוסט אחד',tag:'מתוזמן',state:'idle'},
  ];
}
/* תהליך העבודה: היומן החי של הסוכנים — מה כל אחד עושה, ומה הוא מעביר למי. החדש למעלה */
function realWorkflow(n){
  const ago=t=>{const d=new Date(t),now=new Date(),hm=d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false});
    const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),diff=Math.round((day(now)-day(d))/864e5);
    return diff===0?hm:diff===1?`אתמול ${hm}`:`${d.getDate()}.${d.getMonth()+1} ${hm}`};
  const logs=RUNS.filter(r=>r.stats&&r.stats.log).slice(0,60);
  if(!logs.length)return[{cmd:`${n('strategist')}.ממתין`,out:'כאן תראה בזמן אמת מה כל סוכן עושה. הסריקה הבאה: 05:15 או 17:15.',tag:'מתוזמן',state:'idle'}];
  const live=Date.now()-new Date(logs[0].created_at)<4*6e4;
  return logs.map((r,i)=>({cmd:`${n(r.agent||'hunter')}.${r.stats.to?'← '+n(r.stats.to):''}`.replace(/\.$/,''),out:r.stats.log,
    tag:ago(r.created_at),state:live&&i===0?'working':'idle'}));
}
// The Office engine reads DOMS[selDom]; findjob has exactly one domain.
const DOMS=[CAREER]; let selDom=0, selAg=0;

/* ═════════ data — jobs ═════════ */
const DEMO_JOBS={
  'j-mobileye':{co:'Mobileye',ini:'Me',c:['#0E7C86','#19A7A6'],title:'Computer Vision Student',loc:'ירושלים · משרת סטודנט',fit:4.5,
    reasons:['OpenCV ו-TensorFlow — אותו stack של AI Smart Crosswalk','משרת סטודנט, מתאים לשנה ג׳','צוות מחקר שעובד עם Python ו-C++'],
    gaps:['C++ מודרני (17/20) מופיע כדרישה'],tags:['Python','OpenCV','Deep Learning'],src:'אתר החברה',posted:1,salary:'₪60–75 לשעה',
    desc:'הצטרפות לצוות אלגוריתמים בתחום זיהוי אובייקטים בזמן אמת. 24 שעות שבועיות לפחות, גמישות בתקופת מבחנים.',deck:true},
  'j-guardz':{co:'Guardz',ini:'Gz',c:['#2B2D42','#4A4E78'],title:'Junior Software Engineer',loc:'תל אביב',fit:4.4,
    reasons:['Python ו-Backend הם הליבה של המשרה','מוגדרת לג׳וניורים, ללא דרישת שנות ניסיון','סטארט-אפ סייבר בצמיחה עם צוות קטן'],
    gaps:['Kubernetes — יתרון, לא חובה'],tags:['Python','AWS','REST'],src:'LinkedIn',posted:2,salary:'',
    desc:'פיתוח שירותי backend לפלטפורמת אבטחה לעסקים קטנים. עבודה צמודה עם צוות המוצר.',deck:true},
  'j-riskified':{co:'Riskified',ini:'Rf',c:['#3B5BDB','#5C7CFA'],title:'Junior Backend Engineer',loc:'תל אביב · היברידי',fit:4.1,
    reasons:['Python ו-SQL מופיעים בראש הדרישות','תוכנית קליטה מסודרת לג׳וניורים'],
    gaps:['Kafka','מערכות מבוזרות'],tags:['Python','SQL','Microservices'],src:'Greenhouse',posted:3,salary:'₪18–22K',
    desc:'צוות Data Platform מחפש מהנדס backend לבניית pipelines של עיבוד עסקאות בזמן אמת.',deck:true},
  'j-vhive':{co:'vHive',ini:'vH',c:['#F08C00','#FFA94D'],title:'Full Stack Developer',loc:'פתח תקווה',fit:4.0,
    reasons:['React ו-Socket.IO — כמו המערכות בזמן אמת שבנית','Computer Vision ברחפנים, מתחבר לפרויקט שלך'],
    gaps:['Docker','בסיסי נתונים גאוגרפיים'],tags:['React','Node.js','Real-time'],src:'Indeed',posted:4,salary:'',
    desc:'פיתוח ממשק ניהול לצי רחפנים אוטונומיים, מהשרת ועד התצוגה.',deck:true},
  'j-checkpoint':{co:'Check Point',ini:'CP',c:['#C2255C','#E64980'],title:'Software Engineer Student',loc:'תל אביב · משרת סטודנט',fit:3.9,
    reasons:['C++ ו-Linux מהקורסים ומהפרויקטים','משרת סטודנט עם מסלול להמשך'],
    gaps:['Networking','Reversing — יתרון'],tags:['C++','Linux'],src:'Comeet',posted:5,salary:'₪55–65 לשעה',
    desc:'פיתוח רכיבי אבטחה בצוות Threat Prevention. נדרשות 20 שעות שבועיות.',deck:true},
  'j-earnix':{co:'Earnix',ini:'Ex',c:['#2F9E44','#51CF66'],title:'Automation Engineer',loc:'רמת גן',fit:3.6,
    reasons:['Python לאוטומציה ובדיקות'],gaps:['CI/CD','Selenium / Playwright'],tags:['Python','QA Automation'],src:'Indeed',posted:6,salary:'',
    desc:'בניית תשתית בדיקות אוטומטיות למערכת תמחור ביטוחית.',deck:true},
  'j-monday':{co:'Monday.com',ini:'mo',c:['#6741D9','#9775FA'],title:'Full-Stack Developer',loc:'תל אביב · היברידי',fit:4.6,
    reasons:['React ו-TypeScript','צוות פלטפורמה עם Node.js'],gaps:['GraphQL'],tags:['React','TypeScript','Node.js'],src:'Greenhouse',posted:12,salary:'',
    desc:'פיתוח full-stack בצוות פלטפורמה של Work OS.',deck:false},
  'j-wix':{co:'Wix',ini:'Wx',c:['#1C1C1C','#495057'],title:'Frontend Engineer',loc:'תל אביב · היברידי',fit:4.2,
    reasons:['React ו-TypeScript','רכיבי drag & drop מורכבים'],gaps:['בדיקות E2E'],tags:['React','TypeScript'],src:'אתר החברה',posted:14,salary:'',
    desc:'פיתוח רכיבי עורך מתקדמים בצוות Editor.',deck:false},
};
/* משרות אמיתיות: אם נבנה עם קובץ התוצאות של דורון (memory/feed/jobs.json), רק הן מוצגות */
const CLOUDM=typeof CLOUD!=='undefined'&&!!CLOUD;   // גרסת הענן: משתמש מחובר, נתונים ב-Supabase
let FEEDD=(typeof FEED!=='undefined'&&FEED)?FEED:null;
const REAL=CLOUDM||!!(FEEDD&&Array.isArray(FEEDD.jobs));
const PALETTE=[['#0F6E54','#2BA37E'],['#14532D','#3F8F5F'],['#0E7C86','#19A7A6'],['#2F5D50','#5E9C88'],['#365314','#65A30D'],['#134E4A','#2DD4BF']];
function coIni(n){const w=String(n||'?').replace(/[^A-Za-z0-9\u0590-\u05FF ]/g,'').trim().split(/\s+/);return (w.length>1?w[0][0]+w[1][0]:w[0].slice(0,2))||'?'}
function fromFeed(f){const o={};f.jobs.forEach((j,i)=>{let h=0;for(const ch of j.co)h=(h*31+ch.charCodeAt(0))>>>0;
  o[j.id]={co:j.co,ini:coIni(j.co),c:PALETTE[h%PALETTE.length],title:j.title,loc:j.loc,fit:j.fit,reasons:j.reasons||[],gaps:j.gaps||[],
    partial:!!j.partial,tags:j.tags||[],src:j.src,posted:j.posted_days,salary:j.salary||'',desc:String(j.desc||'').replace(/[*#_`>\\]/g,'').replace(/\s+/g,' ').trim(),url:j.url,letter:j.letter||null,brief:j.brief||null,prep:j.prep||null,closed_at:j.closed_at||null,warn:j.warn||'',deck:true}});return o}
let JOBS=CLOUDM?{}:FEEDD?fromFeed(FEEDD):DEMO_JOBS;
function feedWhen(){if(!FEEDD||!FEEDD.generated_at)return'';const d=new Date(FEEDD.generated_at),h=Math.round((Date.now()-d)/36e5);
  return h<1?'מהשעה האחרונה':h<24?`מלפני ${h===1?'שעה':h===2?'שעתיים':h+' שעות'}`:`מ-${d.toLocaleDateString('he-IL')}`}
let DECK=Object.keys(JOBS).filter(k=>JOBS[k].deck);
let FILTERED_OUT=REAL?((FEEDD&&FEEDD.stats&&FEEDD.stats.too_senior)||0):3;
function setFeed(f){FEEDD=f;JOBS=fromFeed(f);DECK=Object.keys(JOBS);FILTERED_OUT=(f.stats&&f.stats.too_senior)||0}

