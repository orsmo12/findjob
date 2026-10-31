/* ═════════ applications: stages ═════════ */
const STATUSES={saved:'שמור',applied:'הוגש',screening:'סינון',interview:'ראיון',offer:'הצעה',rejected:'נדחה',ghosted:'אין מענה',withdrew:'ויתרתי'};
const CLOSED=['rejected','ghosted','withdrew'];
const SEGS=[['all','הכל'],['saved','שמור'],['applied','הוגש'],['screening','סינון'],['interview','ראיון'],['offer','הצעה'],['closed','נסגרו']];

/* ═════════ agent messages (live in the Office) ═════════ */
const UPDATES=[
  {a:1,time:'לפני 12 דק׳',body:'סרקתי הלילה 41 משרות. 6 מתאימות לך, ו-3 בכירות מדי סיננתי.'},
  {a:4,time:'לפני 40 דק׳',body:'מצאתי 2 פוסטים חמים של מגייסים בחברות שברשימה שלך. הכנתי לך תגובות.'},
  {a:3,time:'לפני שעה',body:'ההכנה לראיון ב-Monday.com מוכנה: 5 שאלות, ולכל אחת דוגמה מהניסיון שלך.'},
  {a:2,time:'לפני 3 שעות',body:'בדקתי את Guardz: צוות קטן שמגייס ג׳וניורים עכשיו. כדאי לפנות השבוע.'},
  {a:5,time:'אתמול',body:'המכתב ל-Wix מוכן. הוא מבוסס רק על מה שכתוב בקורות החיים שלך.'},
  {a:0,time:'יום ראשון',body:'יעד השבוע: 5 הגשות טובות, לא 15 מהירות. כרגע 2 מתוך 5.'},
  {a:5,time:'יום ראשון',body:'Wix לא ענו כבר שבוע. הכנתי הודעת המשך קצרה.'},
];

/* ═════════ LinkedIn ═════════ */
const LI_URL='https://www.linkedin.com/';
const liSearch=q=>'https://www.linkedin.com/search/results/people/?keywords='+encodeURIComponent(q);
const POSTS=[
  {id:'p1',author:'מיכל אברהם',role:'גיוס, Riskified',mins:22,lang:'he',why:'מגייסת בחברה שברשימה שלך',
   text:'מגייסים 3 ג׳וניורים ל-Backend בצוות Data Platform. אם בניתם משהו אמיתי עם Python מחוץ לקורסים, אשמח לשמוע מה למדתם ממנו 👇',
   drafts:[
    {k:'ניסיון אישי',t:'בניתי מערכת סוכנים ב-Python ו-LangGraph שסורקת משרות כל לילה. הלקח הכי גדול שלי: להגביל קריאות API לפני שמגיעים לתקרה, לא אחרי. איך הצוות שלכם מתמודד עם עומסים בזמן אמת?'},
    {k:'שאלה',t:'פוסט מעניין. בפרויקט AI Smart Crosswalk עבדתי עם Computer Vision ב-Python, ותמיד מתלבט מה עדיף להציג. מה הכי חשוב לכם לראות אצל ג׳וניור: עומק בפרויקט אחד או רוחב?'}]},
  {id:'p2',author:'Daniel Cohen',role:'Engineering Manager, Guardz',mins:48,lang:'en',why:'מנהל פיתוח בחברה שמגייסת עכשיו',
   text:'What separates a junior who ramps up in 3 months from one who takes a year? In my experience: asking good questions early, and writing things down.',
   drafts:[
    {k:'ניסיון אישי',t:'Agree. Writing a question down before asking it often answers half of it. As a student building a multi-agent app in Python, I am curious: how does your team make it easy for juniors to ask the other half?'},
    {k:'שאלה',t:'Great point. Do you see a difference between juniors who ask in public channels and those who ask in private messages? Curious which one your team encourages, and why.'}]},
  {id:'p3',author:'יעל בן-דוד',role:'CTO, vHive',mins:300,lang:'he',why:'Computer Vision, כמו הפרויקט שלך',
   text:'שלוש שנים של Computer Vision על רחפנים לימדו אותנו שמודל טוב שווה פחות מ-pipeline נתונים טוב. מה הלקח הכי גדול שלכם מעבודה עם נתונים אמיתיים?',
   drafts:[
    {k:'ניסיון אישי',t:'מתחבר מאוד. ב-AI Smart Crosswalk עבדתי עם Computer Vision על צילומים מהעולם האמיתי, וזה בדיוק המקום שבו הנתונים קובעים. מעניין איך אתם מתייגים נתונים בקנה מידה כזה.'},
    {k:'שאלה',t:'לקח חשוב. איך אתם מחליטים מתי להשקיע באיסוף נתונים חדשים ומתי בשיפור המודל הקיים?'}]},
];
const LI_FIXES=[
  {id:'f1',t:'כותרת עם תפקיד ותחום',why:'מגייסים מחפשים לפי מילות מפתח בכותרת.',copy:'Computer Science Student @ HIT | Python · React · AI Agents | Looking for Junior Backend & AI roles'},
  {id:'f2',t:'About עם תוצאות ומספרים',why:'"בניתי" חזק יותר כשרואים מה זה עשה.',copy:'Third-year CS student at HIT. I build things that run in production: Lifeboard, a multi-agent career platform in Python, LangGraph and Next.js that scans jobs every night, and AI Smart Crosswalk, a real-time computer vision system. Former logistics officer and deputy company commander in the IDF.'},
  {id:'f3',t:'כישורים שחסרים',why:'כישורי AI הם מה שמחפשים היום.',copy:'LangGraph, FastAPI, Prompt Engineering, Computer Vision, Supabase'},
  {id:'f4',t:'GitHub מחובר לפרופיל',why:'פרויקטים אמיתיים מקבלים יותר פניות ממגייסים.',copy:''},
  {id:'f5',t:'Open to Work למגייסים בלבד',why:'מגייסים רואים שאתה זמין, בלי תווית על התמונה.',copy:''},
];
const PEOPLE=[
  {id:'n1',name:'רוני שפירא',role:'Backend Engineer, Riskified',why:'בוגר HIT',note:'היי רוני, אני סטודנט שנה ג׳ במדעי המחשב ב-HIT ומתעניין בצוות ה-Backend ב-Riskified. אשמח להתחבר ולשמוע איך היה המעבר שלך מהלימודים לתעשייה.'},
  {id:'n2',name:'נועה לוי',role:'Talent Acquisition, Mobileye',why:'מגייסת למשרות סטודנט',note:'היי נועה, אני סטודנט שנה ג׳ במדעי המחשב עם פרויקט Computer Vision בזמן אמת. ראיתי שאת מגייסת למשרות סטודנט ב-Mobileye ואשמח להתחבר.'},
  {id:'n3',name:'איתי גולן',role:'Team Lead, Monday.com',why:'שירת ביחידה טכנולוגית',note:'היי איתי, יש לי ראיון בקרוב לצוות הפלטפורמה ב-Monday.com. אשמח להתחבר ולשמוע ממך על אופי העבודה בצוות.'},
];
const POST_DRAFT='בונה בפומבי: Lifeboard 🧵\n\nהשבוע עבדתי על "שומר תקציב" לסוכני ה-AI שלי: רכיב שמחליט אילו משימות חשובות עכשיו ואילו יכולות לחכות למחר, כדי שהמערכת תרוץ כל לילה בלי לעבור את מכסת ה-API.\n\nמה שלמדתי: מערכת טובה יודעת לעצור בזמן, לא רק לרוץ מהר.\n\nמה הרכיב הכי קטן שבניתם שחסך לכם הכי הרבה כאב ראש?';
const WEEK_GOAL={comments:5,posts:1};

/* ═════════ per-application extras ═════════ */
const REFERRALS={
  'j-monday':[{name:'איתי גולן',role:'Team Lead, Platform',why:'שירת ביחידה טכנולוגית'}],
  'j-wix':[{name:'שירה כהן',role:'Frontend Engineer, Editor',why:'בוגרת HIT 2023'}],
  'j-mobileye':[{name:'נועה לוי',role:'Talent Acquisition',why:'מגייסת למשרות סטודנט'}],
  'j-guardz':[{name:'Daniel Cohen',role:'Engineering Manager',why:'פרסם השבוע על גיוס ג׳וניורים'}],
  'j-riskified':[{name:'רוני שפירא',role:'Backend Engineer',why:'בוגר HIT'}],
};
const refNote=(r,j)=>`היי ${r.name}, ראיתי שאתה ב-${j.co} ואני מתעניין במשרת ה-${nb(j.title)}. אני סטודנט למדעי המחשב. אשמח לשמוע ממך על הצוות, ואם זה מתאים, גם להמלצה.`;
const PREP={
  screening:{title:'שאלות סינון',lead:'מגייסים שולחים היום שאלות קצרות לפני השיחה הראשונה, בטקסט או בווידאו. אלה השאלות שכדאי להכין:',
    qs:[{tag:'מוטיבציה',q:'למה דווקא החברה הזו?',h:'שני משפטים: משהו ספציפי במוצר שלהם, וקשר לפרויקט שלך.'},
        {tag:'זמינות',q:'מתי אתה יכול להתחיל, וכמה שעות בשבוע?',h:'תשובה מדויקת, בלי "גמיש". זה מה שהמגייס מסמן בטופס.'},
        {tag:'ניסיון',q:'ספר על פרויקט אחד שבנית מאפס.',h:'60 שניות: מה הבעיה, מה בנית, ומה יצא. מספר אחד לפחות.'}]},
  interview:{title:'הכנה לראיון',lead:'השאלות מבוססות על מודעת המשרה ועל מה שנמצא על החברה. לחץ על שאלה כדי לראות איך לבנות את התשובה.',
    qs:[{tag:'System Design',q:'איך היית מתכנן מערכת התראות לבורד עם מיליון משתמשים?',h:'<b>מבנה:</b> דרישות ← רכיבים (API, תור הודעות, workers, WebSocket) ← צוואר בקבוק ← פשרות. <b>מהניסיון שלך:</b> Socket.IO במערכות זמן אמת.'},
        {tag:'Backend',q:'מה ההבדל בין SQL ל-NoSQL, ומתי תבחר בכל אחד?',h:'<b>בקצרה:</b> קשרים ועקביות ← SQL. סכמה גמישה וגדילה ← NoSQL. <b>דוגמה:</b> למה בחרת ב-Postgres ב-Lifeboard.'},
        {tag:'פרויקט',q:'ספר על האתגר הטכני הכי קשה בפרויקט שאתה גאה בו.',h:'<b>STAR:</b> מצב ← משימה ← פעולה ← תוצאה. מבנק הסיפורים: "Lifeboard: מגבלת API".'},
        {tag:'Debugging',q:'ספר על באג קשה שפתרת.',h:'<b>מה מחפשים:</b> שיטתיות. שחזור, בידוד, השערה, בדיקה, מניעה.'},
        {tag:'צוות',q:'מה אתה עושה כשאתה לא מסכים עם החלטה של הצוות?',h:'<b>יתרון שלך:</b> השירות כסגן מ״פ. דוגמה להבעת עמדה, הקשבה והחלטה.'}]},
};

/* ═════════ state ═════════ */
function defaultState(){return{
  v:2,onboarded:false,
  profile:{name:'Or Smolarchik',first:'אור',cv:'',cvName:'',key:'',ans:{}},qi:0,team:{},
  decisions:{},skipReasons:{},
  apps:REAL?[]:[
    {id:'a-monday',jobId:'j-monday',status:'interview',date:daysAgoISO(6),iv:'רביעי, 14:00'},
    {id:'a-wix',jobId:'j-wix',status:'applied',date:daysAgoISO(9)},
  ],
  todos:REAL?[]:[
    {id:'t1',text:'להעלות את Lifeboard ל-GitHub עם README מסודר',done:false},
    {id:'t2',text:'לבקש המלצה מהמרצה בקורס מערכות מבוזרות',done:false},
    {id:'t3',text:'לעדכן את קורות החיים עם הפרויקט האחרון',done:true},
  ],
  li:{handled:{},drafts:{},fixes:{},people:{},comments:0,posts:0},
  stories:[
    {id:'s1',t:'Lifeboard: מגבלת API',b:'מצב: הסוכנים של Lifeboard צורכים מכסת API מוגבלת.\nמשימה: לשמור על ריצה יומית בלי לשלם.\nפעולה: תכננתי שומר תקציב שמתעדף משימות ודוחה את השאר.\nתוצאה: '},
    {id:'s2',t:'AI Smart Crosswalk: נתונים אמיתיים',b:'מצב: מערכת Computer Vision למעבר חצייה חכם.\nמשימה: \nפעולה: \nתוצאה: '},
    {id:'s3',t:'סגן מ״פ: החלטה תחת לחץ',b:'מצב: \nמשימה: \nפעולה: \nתוצאה: '},
  ],
  notif:true,todoOpen:false,
}}
const SKEY=REAL?'state3':'state2';  // גרסה אמיתית מתחילה נקייה, בלי נתוני הדגמה
let S=LS.get(SKEY,null);
const initials=n=>{n=String(n||'?').trim();return /^[\u0590-\u05FF]/.test(n)?[...n][0]:n.slice(0,2)};
const salaryTxt=j=>j.salary||'לא פורסם';
if(!S){const old=REAL?null:LS.get('state',null);S=defaultState();if(old){S.onboarded=!!old.onboarded;S.qi=old.qi||0;if(old.profile)S.profile=Object.assign(S.profile,old.profile);}}
else S=Object.assign(defaultState(),S);
function save(){LS.set(SKEY,S);if(CLOUDM&&typeof cloudSync==='function')cloudSync()}
function applyTeam(){CAREER.agents.forEach((a,i)=>{a.name=(S.team&&S.team[a.key])||TEAM_DEFAULT[i].name});buildWorkflow()}
if(!S.team)S.team={};
if(S.profile&&S.profile.first==='Or')S.profile.first='אור';
applyTeam();
const prof=()=>S.profile;
const STATUS_SHORT={'סטודנט/ית':'סטודנט','בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה':'בוגר טרי','ג׳וניור עם ניסיון של עד שנתיים':'ג׳וניור','עובד/ת ומחפש/ת לעבור':'מחפש מעבר','משתחרר/ת משירות':'משתחרר','לא עובד/ת כרגע':'מחפש עבודה'};
const goalTxt=()=>{const a=prof().ans||{};return [(a.roles||[]).slice(0,2).join(', ')||'עוד לא בחרת תפקיד',STATUS_SHORT[a.status],(a.locs||[])[0]].filter(Boolean).join(' · ')};
const queue=()=>DECK.filter(id=>!S.decisions[id]);
const appOf=id=>S.apps.find(a=>a.id===id);
const followDue=a=>a.status==='applied'&&daysSince(a.date)>=7;
const appNeedsMe=a=>a.status==='saved'||followDue(a)||a.status==='screening'||a.status==='interview';
const hotPosts=()=>CLOUDM?((typeof LI!=='undefined'&&LI.posts)||[]).filter(p=>!S.li.handled[p.id]):REAL?[]:POSTS.filter(p=>p.mins<60&&!S.li.handled[p.id]);
const fixesLeft=()=>CLOUDM?((typeof LI!=='undefined'&&LI.fixes)||[]).filter(f=>!S.li.fixes[f.id]):REAL?[]:LI_FIXES.filter(f=>!S.li.fixes[f.id]);
const liScore=()=>Math.min(100,62+Object.keys(S.li.fixes).length*8);
const nb=x=>String(x).replace(/ /g,'\u00A0');
const letterFor=j=>`שלום,

אני ${prof().name}, סטודנט שנה שלישית למדעי המחשב ב-HIT. ראיתי את משרת ה-${nb(j.title)} ב-${j.co}, והיא מתאימה בדיוק לכיוון שאני בונה.

${j.reasons[0]}. בנוסף פיתחתי את Lifeboard, מערכת עם סוכני AI ב-Next.js ו-Python שמריצה כל לילה איסוף וניתוח של משרות.

אשמח לשיחה קצרה כדי לשמוע עוד על הצוות.

תודה,
${prof().name}`;
const followText=j=>`שלום,

הגשתי לפני כשבוע מועמדות למשרת ה-${nb(j.title)}. אני עדיין מאוד מעוניין ואשמח לדעת אם יש עדכון לגבי התהליך.

תודה,
${prof().name}`;

/* clipboard with fallback (some app views refuse the async API) */
async function copyText(t,msg){
  let ok=false;
  try{await navigator.clipboard.writeText(t);ok=true}catch(e){
    try{const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(ta);ta.select();ok=document.execCommand('copy');ta.remove()}catch(e2){}
  }
  toast(ok?(msg||'הועתק'):'לא הצלחתי להעתיק. סמן את הטקסט והעתק ידנית');
  return ok;
}
