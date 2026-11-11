/* ═════════ ONBOARDING ═════════ */
let onbStep=0, onbDraft=null, onbSingle=false;
function openOnb(step=0){onbSingle=step>0&&S.onboarded;onbStep=step;onbDraft=JSON.parse(JSON.stringify(prof()));closeSheet();closeDrawer();$('onb').classList.add('open');renderOnb()}
function closeOnb(){$('onb').classList.remove('open','qmode')}
function onbGo(d){onbStep=Math.max(0,Math.min(4,onbStep+d));track('onb_step',{s:onbStep});if(onbStep===2)qi=Math.min(S.qi||0,Math.max(0,visibleQs().length-1));renderOnb()}
function renderOnb(){
  if(onbStep===2){renderQ();return}
  $('onb').classList.remove('qmode');
  const p=onbDraft;p.cv=prof().cv;p.cvName=prof().cvName;
  $('onbSteps').innerHTML=[0,1,2,3,4].map(i=>`<i class="${i===onbStep?'on':i<onbStep?'done':''}"></i>`).join('');
  $('onbBack').style.visibility=onbStep>0&&onbStep<4||onbSingle?'visible':'hidden';$('onbBack').textContent=onbSingle?'סגור':'חזרה';$('onbBack').onclick=onbSingle?closeOnb:()=>onbGo(-1);
  let body='',foot='';
  if(onbStep===0){
    body=`<div class="logo-mark" style="margin-bottom:22px"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.8l1.8 1.8L13.3 9"/></svg></div>
      <h1>משרד מלא שמחפש לך עבודה, ואתה רק מחליט.</h1><p class="lead">findjob סורק משרות ביום ובלילה, מדרג כל אחת מול קורות החיים והפרופיל האישי שלך ומכין מכתב פנייה.</p>${CLOUDM?`<p class="help" style="margin-top:14px">זו גרסת ניסיון. כדי לשפר אותה נשמרים נתוני שימוש בסיסיים, כמו כמה משרות שמרת ואילו מסכים פתחת. התוכן שלך, כמו קורות החיים והמכתבים, לא נכלל בהם. בתפריט יש כפתור משוב.</p>`:''}`;
    foot=`<button class="btn btn-primary btn-block" onclick="onbGo(1)">בוא נתחיל</button>`;
  }else if(onbStep===1){
    body=`<h1>נעים להכיר</h1><p class="lead">מקורות החיים הסוכנים לומדים מה אתה יודע לעשות. הקובץ נשאר שלך ואפשר למחוק אותו בכל רגע.</p>
      <div class="field"><label for="onbFirst">איך לקרוא לך?</label><input id="onbFirst" value="${escB(prof().first)}" maxlength="20" autocomplete="given-name" oninput="prof().first=this.value.trim()||prof().first;save()"></div>
      <label for="cvFile" class="drop${p.cvName?' has':''}" role="button" tabindex="0"><span style="font-size:30px">${p.cvName?'✓':'📄'}</span><b>${p.cvName?escB(p.cvName):'בחר קובץ'}</b><span>${p.cvName?'לחץ להחלפה':'PDF, Word או טקסט'}</span></label>${S.cv_err?`<div class="cv-err" role="alert">${escB(S.cv_err)}</div>`:''}
      <div class="field" style="margin-top:18px"><label for="onbCv">או הדבק את הטקסט</label><textarea id="onbCv" rows="6" placeholder="סטודנט שנה ג׳ למדעי המחשב…" oninput="onbCvTyped(this)" onchange="onbCvTyped(this)" onkeyup="onbCvTyped(this)" onpaste="setTimeout(()=>onbCvTyped(this),0)">${escB(p.cv)}</textarea><div class="help" id="onbCvHelp"></div></div>`;
    foot=`<button class="btn btn-primary btn-block" id="onbNext" onclick="onbCvNext()">המשך</button><button class="link-btn" onclick="onbCvLater()">אוסיף אחר כך</button>`;
  }else if(onbStep===3&&CLOUDM){
    body=aiKeyStep();
    foot=`<button class="btn btn-primary btn-block" id="akBtn" ${S.ai_key?'':'disabled'} onclick="saveAiKey(true)">${S.ai_key?'להמשיך':'לשמור ולהמשיך'}</button><button class="link-btn" onclick="${onbSingle?'closeOnb()':"track('ai_key_skip');S.ak_pending=0;onbGo(1)"}">${onbSingle?'ביטול':'לדלג בינתיים'}</button>`;
  }else if(onbStep===3){
    body=`<h1>צעד אחרון: לחבר את הסוכנים</h1><p class="lead">הסוכנים צריכים מפתח אישי כדי לעבוד בשבילך. זה חינם ולוקח שתי דקות.</p>
      <div class="key-steps"><div><span>להיכנס ל-<a href="https://console.groq.com/keys" target="_blank" rel="noopener" lang="en">console.groq.com/keys</a> עם חשבון Google</span></div><div><span>ללחוץ <span lang="en">Create API Key</span> ולהעתיק את המפתח</span></div><div><span>להדביק אותו כאן</span></div></div>
      <div class="field"><label for="onbKey">המפתח האישי</label><input id="onbKey" class="ltr" placeholder="gsk_..." value="${esc(p.key)}" autocomplete="off" spellcheck="false" oninput="onbDraft.key=this.value.trim();$('onbKeyBtn').disabled=!/^gsk_\\w{20,}/.test(onbDraft.key)">
        <div class="help">המפתח נשמר אצלך ומשמש רק את הסוכנים שלך.</div></div>`;
    foot=`<button class="btn btn-primary btn-block" id="onbKeyBtn" ${/^gsk_\w{20,}/.test(p.key)?'':'disabled'} onclick="onbNext()">${onbSingle?'שמור':'לחבר ולהמשיך'}</button><button class="link-btn" onclick="${onbSingle?'closeOnb()':'onbGo(1)'}">${onbSingle?'ביטול':'אחבר אחר כך'}</button>`;
  }else{
    body=`<div class="empty-ic" style="margin:20px 0 22px;background:var(--mint-lt)">✓</div><h1>הכל מוכן, ${escB(p.first)}</h1>
      <p class="lead">${CLOUDM?N('hunter')+' יחפש לך משרות בסריקה הקרובה, לפי קורות החיים והתשובות שלך.':p.key?N('hunter')+' כבר מחפש לך משרות.':'כשתחבר את הסוכנים, '+N('hunter')+' יתחיל לחפש לך משרות.'} בינתיים הכנו ${DECK.length} משרות לדוגמה: מחליקים ימינה כדי לשמור ושמאלה כדי לדלג.</p>`;
    foot=`<button class="btn btn-primary btn-block" onclick="finishOnb('jobs')">למשרות</button><button class="link-btn" onclick="finishOnb('main')">ללוח הבקרה</button>`;
  }
  $('onbBody').innerHTML=body;$('onbFoot').innerHTML=foot;$('onbBody').scrollTop=0;
}
function onbCvTyped(t){prof().cv=t.value;save();const h=$('onbCvHelp');if(h)h.textContent=''}
function onbCvNext(){const t=$('onbCv');if(t)prof().cv=t.value;save();
  if(prof().cv.trim().length>=CV_MIN){S.cv_err='';onbGo(1);return}
  const h=$('onbCvHelp');if(h){h.textContent='צריך את קורות החיים כדי שהסוכנים יוכלו לחפש. בחר קובץ או הדבק את הטקסט.';h.style.color='var(--rose)'}}
/* דילוג על קורות החיים: מותר, אבל ברור שבלעדיהם אין חיפוש. לחיצה ראשונה מזהירה, שנייה ממשיכה */
let cvLaterWarned=false;
function onbCvLater(){if(prof().cv.trim().length>=CV_MIN||cvLaterWarned){onbGo(1);return}cvLaterWarned=true;track('cv_later');
  const h=$('onbCvHelp');if(h){h.textContent=`בלי קורות חיים ${N('hunter')} לא יכול לחפש ולדרג משרות. אפשר להוסיף אחר כך מהפרופיל. ללחוץ שוב כדי להמשיך בלי.`;h.style.color='var(--rose)'}}
function onbNext(){commitOnb();if(onbSingle){closeOnb();curPg==='settings'?renderSettings():renderProfile();toast(prof().key?'הסוכנים מחוברים':'נשמר')}else onbGo(1)}
function commitOnb(){const keep={cv:prof().cv,cvName:prof().cvName,ans:prof().ans||{}};S.profile=Object.assign({},onbDraft,keep);save();syncChrome()}
function finishOnb(pg){commitOnb();const first=!S.onboarded;if(first)track('onb_done',{domain:(prof().ans||{}).domain||''});S.onboarded=true;save();closeOnb();goPage(pg);
  if(first&&CLOUDM&&!Object.keys(JOBS||{}).length&&typeof prepNow==='function'&&prof().cv.trim().length>=CV_MIN)setTimeout(()=>prepNow('scan'),2500);   // בלי קורות חיים אין סריקה, ולא מעמידים פנים   // סריקה ראשונה מיד, לא מחכים לסריקה הקבועה
  if(curPg===pg&&pg==='main')renderHome();if(!S.tourDone&&pg==='main')setTimeout(tourStart,700)}

/* ═════════ QUESTIONNAIRE — one question per screen ═════════
   לימודים ועבודה הן שתי שאלות נפרדות (כל שילוב אפשרי: סטודנט שנה ה׳ שעובד בתחום וכו׳).
   כמה תחומים, היקף משרה לכולם, ו"אחר" עם טקסט חופשי בכל שאלה שזה הגיוני בה.
   normAns() גוזר את השדות הישנים (status, track, domain) כדי שכל השאר באפליקציה ובשרת ימשיך לעבוד.
   מראה של agent_core/profile.py: normalize_answers. */
const STUDY_DEG='סטודנט/ית לתואר';
const isStudent=a=>a.study===STUDY_DEG||(!a.study&&a.status==='סטודנט/ית');
const wantsPart=a=>(a.scope||[]).includes('משרה חלקית / משרת סטודנט');
const wantsFull=a=>!(a.scope||[]).length||(a.scope||[]).includes('משרה מלאה');
const OTHER='אחר';
function normAns(a){
  if(!a)return a;
  if(a.status&&!a.study&&!a.work){   // משתמש ותיק: מהשאלה הישנה לשתיים החדשות
    const m={'סטודנט/ית':[STUDY_DEG,''],'בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה':['סיימתי תואר','לא עובד/ת כרגע'],'ג׳וניור עם ניסיון של עד שנתיים':['','עובד/ת בתחום'],
      'עובד/ת ומחפש/ת לעבור':['','עובד/ת בתחום'],'משתחרר/ת משירות':['','משתחרר/ת משירות'],'לא עובד/ת כרגע':['','לא עובד/ת כרגע']}[a.status]||['',''];
    if(m[0])a.study=m[0];if(m[1])a.work=m[1]}
  if(a.track&&!a.scope)a.scope={'משרת סטודנט חלקית':['משרה חלקית / משרת סטודנט'],'משרה מלאה אחרי התואר':['משרה מלאה'],'את שתיהן':['משרה מלאה','משרה חלקית / משרת סטודנט']}[a.track];
  if(a.domain&&!a.domains)a.domains=[a.domain];
  if(a.pack&&!a.packs)a.packs={[a.pack.label]:a.pack};
  // שדות ישנים שנגזרים (השרת והמסכים האחרים קוראים אותם)
  const exp=a.exp,senior=['3–5 שנים','יותר מ-5 שנים','יותר מ-10 שנים'].includes(exp);
  a.status=isStudent(a)?'סטודנט/ית':a.work==='משתחרר/ת משירות'?'משתחרר/ת משירות'
    :a.work==='עובד/ת בתחום'?(senior?'עובד/ת ומחפש/ת לעבור':'ג׳וניור עם ניסיון של עד שנתיים')
    :['סיימתי תואר','לימודי הנדסאות או תעודה','קורס או בוטקאמפ'].includes(a.study)||a.work==='עובד/ת בתחום אחר'?'בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה'
    :a.work==='לא עובד/ת כרגע'?'לא עובד/ת כרגע':(a.status||'');
  const sc=a.scope||[];a.track=sc.length===2?'את שתיהן':wantsPart(a)?'משרת סטודנט חלקית':sc.length?'משרה מלאה אחרי התואר':'';
  a.domains=(a.domains||[]).filter(Boolean);a.domain=a.domains[0]||'';
  return a}
/* ערכות תחום: כל משתמש מקבל את התפקידים של התחומים שלו (מראה של agent_core/profile.py) */
const SOFT_ROLES=['Backend','Frontend','Full-Stack','Data / BI','AI / ML','QA ואוטומציה','DevOps / Cloud','סייבר','Embedded'];
const PACKS={'פיתוח תוכנה':{field:['מדעי המחשב','הנדסת תוכנה','הנדסת חשמל או מחשבים','מערכות מידע','מדעי הנתונים או סטטיסטיקה','בוטקאמפ או לימוד עצמי'],roles:SOFT_ROLES,work:'בפיתוח'},
  'הנדסת מכונות':{field:['הנדסת מכונות','הנדסאי מכונות','הנדסת תעשייה וניהול','הנדסה אווירונאוטית','הנדסת חומרים'],
    roles:['תכנון מכני','ייצור ותהליכים','R&D ופיתוח מוצר','איכות','ניהול פרויקטים הנדסיים','סימולציות ו-CAE','אחזקה ותפעול','מערכות ואינטגרציה'],work:'בהנדסה'}};
const MECH_W=['solidworks','autocad','ansys','catia','creo','inventor','gd&t','cnc','mechanical engineering','הנדסת מכונות','תיכון מכני','fea','thermodynamics','שרטוט'],
  SOFT_W=['python','javascript','react','java','sql','developer','node','typescript','git','backend','frontend'];
function cvDomain(cv){const t=(cv||'').toLowerCase(),m=MECH_W.filter(w=>t.includes(w)).length,sw=SOFT_W.filter(w=>t.includes(w)).length;return m>=2&&m>=sw?'הנדסת מכונות':sw>=2?'פיתוח תוכנה':''}
function domainsOf(a){const d=(a.domains||[]).filter(Boolean);return d.length?d:[a.domain||cvDomain(prof().cv)||'פיתוח תוכנה']}
function domainOf(a){return domainsOf(a)[0]}
function domKey(a){const d=domainOf(a);return d==='פיתוח תוכנה'?'software':d==='הנדסת מכונות'?'mechanical':'other'}
function packOf(a,d){if(PACKS[d])return PACKS[d];const p=(a.packs||{})[d]||(a.pack&&a.pack.label===d?a.pack:null);
  return p?{field:(p.field||[]).filter(x=>x&&x!==OTHER),roles:(p.roles||[]).map(r=>r.label),work:'בתחום'}:{field:[],roles:[],work:'בתחום'}}
/* האיחוד של כל התחומים שנבחרו: רקע, תפקידים (וגם תפקידים שהמשתמש תיאר בעצמו) */
function pack(a){const ds=domainsOf(a),ps=ds.map(d=>packOf(a,d)),u=xs=>[...new Set(xs)];
  return {field:u(ps.flatMap(p=>p.field)),roles:u([...ps.flatMap(p=>p.roles),...(a.custom_roles||[]).map(r=>r.label)]),work:ds.length===1?ps[0].work:'בתחום'}}
/* יואב בונה ערכה מטקסט חופשי: kind='domain' (תחום שלם) או 'roles' (תפקידים בתוך התחומים שבחר) */
async function buildPack(hint,kind){const a=ans();if(!CLOUDM||!SB){toast('צריך חיבור לענן כדי לבנות ערכה לתחום שלך');return false}
  const w=$('qOtherWait');const stop=stages(w,kind==='roles'?[`${N('strategist')} קורא מה כתבת…`,'מתרגם לשמות התפקידים כמו שהם מופיעים במודעות…','עוד רגע…']
    :[`${N('strategist')} קורא מה כתבת ואת קורות החיים…`,'בונה רשימת תפקידים וחיפושים בתחום…','עוד רגע…'],3500);
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:prof().cv||'',hint,kind,token:session&&session.access_token})});
    const d=await r.json();if(!r.ok||!d.roles)throw new Error(d.error||'x');stop();
    if(kind==='roles'){const have=new Set((a.custom_roles||[]).map(x=>x.label));a.custom_roles=[...(a.custom_roles||[]),...d.roles.filter(x=>!have.has(x.label))];
      a.custom_he=[...new Set([...(a.custom_he||[]),...(d.he_queries||[])])];a.roles=[...new Set([...(a.roles||[]).filter(x=>x!==OTHER),...d.roles.map(x=>x.label)])];
      toast(`${N('strategist')}: הוספתי ${d.roles.map(x=>x.label).join(', ')}`)}
    else{a.packs=Object.assign({},a.packs,{[d.label]:d});a.domains=[...new Set([...(a.domains||[]).filter(x=>x!=='תחום אחר'),d.label])];
      toast(`${N('strategist')}: הוספתי את התחום ${d.label}`)}
    a[(kind==='roles'?'roles':'domains')+'_other']='';normAns(a);save();return true}
  catch(e){stop();if(w)w.textContent='לא הצלחתי כרגע. נסה לנסח אחרת, או לבחור תחום קרוב.';return false}}
const QS=[
  {id:'study',t:'מה המצב שלך בלימודים?',sub:'יחד עם השאלה הבאה, כך נדע אילו משרות להציג לך.',o:['לא לומד/ת כרגע',STUDY_DEG,'סיימתי תואר','לימודי הנדסאות או תעודה','קורס או בוטקאמפ',OTHER],other:'מה אתה לומד או למדת?'},
  {id:'year',when:isStudent,t:'באיזו שנה אתה בתואר?',o:['שנה א׳','שנה ב׳','שנה ג׳','שנה ד׳','שנה ה׳ ומעלה','תואר שני','דוקטורט']},
  {id:'work',t:'ומה המצב שלך בעבודה?',o:['לא עובד/ת כרגע','עובד/ת בתחום','עובד/ת בתחום אחר','משתחרר/ת משירות',OTHER],other:'ספר בקצרה'},
  {id:'scope',multi:true,t:'איזה היקף משרה אתה מחפש?',sub:'אפשר לבחור את שתיהן.',o:['משרה מלאה','משרה חלקית / משרת סטודנט']},
  {id:'domains',multi:true,t:'באיזה תחומים אתה מחפש עבודה?',sub:'זיהינו מקורות החיים. אפשר לבחור כמה ולהוסיף תחום משלך.',
    o:a=>[...new Set(['פיתוח תוכנה','הנדסת מכונות',...Object.keys(a.packs||{}),...(a.domains||[])])].filter(x=>x&&x!=='תחום אחר').concat([OTHER]),
    other:'איזה תחום? למשל: הנדסה כימית, שיווק דיגיטלי',build:'domain',
    note:a=>(a.domains||[]).length>=4?'טיפ: חיפוש ממוקד בכמה תחומים מוצא משרות מדויקות יותר.':''},
  {id:'field',t:'מה הרקע המקצועי שלך?',o:a=>[...pack(a).field,OTHER],other:'מה הרקע שלך?'},
  {id:'roles',multi:true,t:'אילו תפקידים מעניינים אותך?',sub:'אפשר לבחור כמה ולהוסיף תפקיד משלך.',o:a=>[...pack(a).roles,OTHER],other:'איזה תפקיד? אפשר כמה, מופרדים בפסיק',build:'roles'},
  {id:'exp',t:a=>`כמה ניסיון מעשי יש לך ${pack(a).work}?`,sub:'בתחום שבו אתה מחפש. כולל עבודה, התמחות או פרויקטים בתשלום, גם בזמן הלימודים.',o:['אין עדיין','פחות משנה','1–2 שנים','3–5 שנים','יותר מ-5 שנים','יותר מ-10 שנים']},
  {id:'age',t:'מה הגיל שלך?',sub:'עוזר להתאים לך משרות. לא מופיע במכתבים ולא נשלח למעסיקים.',o:['18–21','22–25','26–29','30–34','35 ומעלה','מעדיף/ה לא לציין']},
  {id:'army',t:'מה עשית בשירות?',sub:'בישראל זה חלק חשוב מקורות החיים, במיוחד בתחילת הדרך.',o:['שירות טכנולוגי (8200, ממר״ם וכד׳)','קרבי','קצונה או תפקיד פיקודי','שירות אחר','שירות לאומי','לא שירתתי'],other:false},
  {id:'locs',multi:true,t:'איפה נוח לך לעבוד?',sub:'אפשר לבחור כמה.',o:['תל אביב','גוש דן והמרכז','השרון','ירושלים','חיפה והצפון','באר שבע והדרום',OTHER],other:'איזו עיר או אזור?'},
  {id:'mode',t:'איך אתה מעדיף לעבוד?',o:['מהמשרד','היברידי','מהבית','לא משנה לי']},
  {id:'start',t:'מתי אתה יכול להתחיל?',o:a=>['מיד','תוך חודש','בעוד 2–3 חודשים',...(isStudent(a)?['אחרי התואר']:[])]},
  {id:'salaryH',when:wantsPart,t:'כמה שכר לשעה אתה מצפה במשרה חלקית?',o:['עד ₪45','₪45–55','₪55–65','₪65 ומעלה','עוד לא יודע']},
  {id:'salary',when:wantsFull,t:'מה ציפיות השכר שלך במשרה מלאה?',sub:'ברוטו לחודש.',o:['עד ₪12K','₪12–16K','₪16–20K','₪20–25K','₪25K ומעלה','עוד לא יודע']},
  {id:'english',t:'מה רמת האנגלית שלך?',o:['שפת אם','שוטפת','טובה','בסיסית']},
  {id:'prio',multi:true,max:2,t:'מה הכי חשוב לך בעבודה הבאה?',sub:'עד 2 דברים.',o:['למידה וחניכה','שכר','טכנולוגיות מעניינות','סטארט-אפ קטן','חברה גדולה ויציבה','קרוב לבית','גמישות בשעות',OTHER],other:'מה עוד חשוב לך?'},
];
let qi=0;
const ans=()=>normAns(prof().ans=prof().ans||{});
const visibleQs=()=>{const a=ans();if(!(a.domains||[]).length){const d=cvDomain(prof().cv);if(d)a.domains=[d]}
  return QS.filter(q=>!q.when||q.when(a)).map(q=>({...q,o:typeof q.o==='function'?q.o(a):q.o,t:typeof q.t==='function'?q.t(a):q.t,note:typeof q.note==='function'?q.note(a):''}))};
const qTotal=()=>visibleQs().length+(ans().study?0:1);
const answered=q=>{const v=ans()[q.id];return q.multi?Array.isArray(v)&&v.length>0:!!v};
function qProgress(){const v=visibleQs();return{done:v.filter(answered).length,total:v.length}}
function openQuestions(at){if(at==='status')at='study';if(typeof at==='string')at=visibleQs().findIndex(q=>q.id===at);
  const v=visibleQs();qi=at!=null&&at>=0?at:Math.max(0,v.findIndex(q=>!answered(q)));if(qi<0)qi=0;
  onbSingle=S.onboarded;onbStep=2;onbDraft=JSON.parse(JSON.stringify(prof()));closeSheet();closeDrawer();$('onb').classList.add('open');renderOnb();
}
/* "אחר": שדה טקסט מתחת לתשובות. בתחום ובתפקידים יואב עובר על הטקסט ובונה מזה חיפושים */
const otherOn=(q,a)=>q.other&&(q.multi?(a[q.id]||[]).includes(OTHER):a[q.id]===OTHER);
function renderQ(){try{const q=visibleQs()[qi];if(q)track('onb_q',{q:q.id})}catch(e){}
  const v=visibleQs();
  if(qi>=v.length){qDone();return}
  $('onb').classList.add('qmode');
  const q=v[qi],a=ans(),cur=a[q.id];
  const sel=o=>q.multi?(Array.isArray(cur)&&cur.includes(o)):cur===o;
  const oth=otherOn(q,a),ov=a[q.id+'_other']||'';
  $('onbBody').innerHTML=`
    <div class="q-top"><button class="q-back" aria-label="חזרה" onclick="qBack()"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      <div class="q-prog" aria-hidden="true"><i style="width:${Math.round(qi/Math.max(v.length,qTotal())*100)}%"></i></div>
      <button class="q-later" onclick="qLater()">המשך אחר כך</button></div>
    <div class="q-count num">שאלה ${qi+1} מתוך ${Math.max(v.length,qTotal())}</div>
    <h1 class="q-title">${escB(q.t)}</h1>${q.sub?`<p class="q-sub">${escB(q.sub)}</p>`:''}
    <div class="q-card" role="${q.multi?'group':'radiogroup'}" aria-label="${escB(q.t)}">${q.o.map((o,i)=>`<button class="q-opt${sel(o)?' sel':''}" role="${q.multi?'checkbox':'radio'}" aria-checked="${sel(o)}" onclick="qPick(${i})"><span>${escB(o)}</span><span class="${q.multi?'cb':'rd'}"></span></button>`).join('')}</div>
    ${oth?`<div class="field q-other"><label for="qOther">${escB(q.other)}</label><input id="qOther" value="${escB(ov)}" maxlength="120" autocomplete="off" oninput="ans()['${q.id}_other']=this.value;save();qOtherBtn()" onkeydown="if(event.key==='Enter'){event.preventDefault();qOtherGo()}">
      <div class="help" id="qOtherWait"></div></div>`:''}
    ${q.note?`<p class="q-note">${escB(q.note)}</p>`:''}`;
  const needBuild=oth&&q.build;
  $('onbFoot').innerHTML=q.multi||oth
    ?`<button class="btn btn-primary btn-block" id="qGo" ${answered(q)&&(!oth||ov.trim())?'':'disabled'} onclick="qOtherGo()">${needBuild?`${escB(N('strategist'))}, תוסיף את זה`:'המשך'}</button><button class="link-btn" onclick="qNext()">${needBuild?'המשך בלי זה':'דלג על השאלה'}</button>`
    :`<button class="link-btn" onclick="qNext()">${cur?'המשך':'דלג על השאלה'}</button>`;
  $('onbBody').scrollTop=0;if(oth&&!ov)setTimeout(()=>$('qOther')&&$('qOther').focus(),60);
}
function qOtherBtn(){const q=visibleQs()[qi],b=$('qGo');if(!b)return;const oth=otherOn(q,ans());b.disabled=!answered(q)||(oth&&!(ans()[q.id+'_other']||'').trim())}
async function qOtherGo(){const q=visibleQs()[qi],a=ans();
  if(otherOn(q,a)&&q.build){const t=(a[q.id+'_other']||'').trim();if(!t){qNext();return}
    const b=$('qGo');btnBusy(b,true);const ok=await buildPack(t,q.build);btnBusy(b,false);
    if(ok){if(q.build==='domain'){a.roles=(a.roles||[]).filter(r=>pack(a).roles.includes(r))}renderQ()}return}
  qNext()}
let qLock=false;
function qPick(i){
  if(qLock)return;
  const q=visibleQs()[qi],o=q.o[i],a=ans();
  if(q.multi){let arr=Array.isArray(a[q.id])?a[q.id]:[];
    if(arr.includes(o))arr=arr.filter(x=>x!==o);else{if(q.max&&arr.length>=q.max)arr=arr.slice(1);arr=[...arr,o]}
    a[q.id]=arr;if(q.id==='domains'){const keep=pack(a).roles;a.roles=(a.roles||[]).filter(r=>keep.includes(r)||r===OTHER)}
    normAns(a);save();renderQ();return}
  a[q.id]=o;normAns(a);save();
  if(o===OTHER&&q.other){renderQ();return}   // "אחר": מחכים לטקסט, לא מתקדמים לבד
  document.querySelectorAll('.q-opt').forEach((b,j)=>{b.classList.toggle('sel',j===i);b.setAttribute('aria-checked',j===i)});
  qLock=true;setTimeout(()=>{qLock=false;qNext()},300);
}
function qNext(){qi++;S.qi=qi;save();renderQ()}
function qBack(){if(qi>0){qi--;renderQ()}else if(onbSingle)closeOnb();else{onbStep=1;renderOnb()}}
function qLater(){
  S.qi=qi;onbDraft.ans=prof().ans;commitOnb();
  const first=!S.onboarded;S.onboarded=true;save();closeOnb();
  if(first)goPage('main');else{curPg==='profile'?renderProfile():curPg==='main'?renderHome():0}
  const {done,total}=qProgress();toast(`שמרתי ${done} מתוך ${total} תשובות. אפשר להמשיך מהלוח או מהפרופיל`,{ms:4200});
}
function qDone(){
  S.qi=0;onbDraft.ans=prof().ans;commitOnb();
  if(onbSingle){closeOnb();curPg==='profile'?renderProfile():renderHome();toast(`הפרופיל עודכן. מהחיפוש הבא ${N('hunter')} יתחשב בתשובות`)}
  else{onbStep=3;renderOnb()}
}

