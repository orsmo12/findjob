/* ═════════ ONBOARDING ═════════ */
let onbStep=0, onbDraft=null, onbSingle=false;
function openOnb(step=0){onbSingle=step>0&&S.onboarded;onbStep=step;onbDraft=JSON.parse(JSON.stringify(prof()));closeSheet();closeDrawer();$('onb').classList.add('open');renderOnb()}
function closeOnb(){$('onb').classList.remove('open','qmode')}
function onbGo(d){onbStep=Math.max(0,Math.min(4,onbStep+d));if(onbStep===2)qi=Math.min(S.qi||0,Math.max(0,visibleQs().length-1));renderOnb()}
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
      <label for="cvFile" class="drop${p.cvName?' has':''}" role="button" tabindex="0"><span style="font-size:30px">${p.cvName?'✓':'📄'}</span><b>${p.cvName?escB(p.cvName):'בחר קובץ'}</b><span>${p.cvName?'לחץ להחלפה':'PDF, Word או טקסט'}</span></label>
      <div class="field" style="margin-top:18px"><label for="onbCv">או הדבק את הטקסט</label><textarea id="onbCv" rows="6" placeholder="סטודנט שנה ג׳ למדעי המחשב…" oninput="onbCvTyped(this)" onchange="onbCvTyped(this)" onkeyup="onbCvTyped(this)" onpaste="setTimeout(()=>onbCvTyped(this),0)">${escB(p.cv)}</textarea><div class="help" id="onbCvHelp"></div></div>`;
    foot=`<button class="btn btn-primary btn-block" id="onbNext" onclick="onbCvNext()">המשך</button><button class="link-btn" onclick="onbGo(1)">אוסיף אחר כך</button>`;
  }else if(onbStep===3&&CLOUDM){
    body=aiKeyStep();
    foot=`<button class="btn btn-primary btn-block" id="akBtn" ${S.ai_key?'':'disabled'} onclick="saveAiKey(true)">${S.ai_key?'להמשיך':'לשמור ולהמשיך'}</button><button class="link-btn" onclick="${onbSingle?'closeOnb()':'onbGo(1)'}">${onbSingle?'ביטול':'אחר כך'}</button>`;
  }else if(onbStep===3){
    body=`<h1>צעד אחרון: לחבר את הסוכנים</h1><p class="lead">הסוכנים צריכים מפתח אישי כדי לעבוד בשבילך. זה חינם ולוקח שתי דקות.</p>
      <div class="key-steps"><div><span>להיכנס ל-<a href="https://console.groq.com/keys" target="_blank" rel="noopener" lang="en">console.groq.com/keys</a> עם חשבון Google</span></div><div><span>ללחוץ <span lang="en">Create API Key</span> ולהעתיק את המפתח</span></div><div><span>להדביק אותו כאן</span></div></div>
      <div class="field"><label for="onbKey">המפתח האישי</label><input id="onbKey" class="ltr" placeholder="gsk_..." value="${esc(p.key)}" autocomplete="off" spellcheck="false" oninput="onbDraft.key=this.value.trim();$('onbKeyBtn').disabled=!/^gsk_\\w{20,}/.test(onbDraft.key)">
        <div class="help">המפתח נשמר אצלך ומשמש רק את הסוכנים שלך.</div></div>`;
    foot=`<button class="btn btn-primary btn-block" id="onbKeyBtn" ${/^gsk_\w{20,}/.test(p.key)?'':'disabled'} onclick="onbNext()">${onbSingle?'שמור':'לחבר ולהמשיך'}</button><button class="link-btn" onclick="${onbSingle?'closeOnb()':'onbGo(1)'}">${onbSingle?'ביטול':'אחבר אחר כך'}</button>`;
  }else{
    body=`<div class="empty-ic" style="margin:20px 0 22px;background:var(--mint-lt)">✓</div><h1>הכל מוכן, ${escB(p.first)}</h1>
      <p class="lead">${CLOUDM?N('hunter')+' יחפש לך משרות בסריקה הקרובה (07:00 או 15:00), לפי קורות החיים והתשובות שלך.':p.key?N('hunter')+' כבר מחפש לך משרות.':'כשתחבר את הסוכנים, '+N('hunter')+' יתחיל לחפש לך משרות.'} בינתיים הכנו ${DECK.length} משרות לדוגמה: מחליקים ימינה כדי לשמור ושמאלה כדי לדלג.</p>`;
    foot=`<button class="btn btn-primary btn-block" onclick="finishOnb('jobs')">למשרות</button><button class="link-btn" onclick="finishOnb('main')">ללוח הבקרה</button>`;
  }
  $('onbBody').innerHTML=body;$('onbFoot').innerHTML=foot;$('onbBody').scrollTop=0;
}
function onbCvTyped(t){prof().cv=t.value;save();const h=$('onbCvHelp');if(h)h.textContent=''}
function onbCvNext(){const t=$('onbCv');if(t)prof().cv=t.value;save();
  if(prof().cvName||prof().cv.trim().length>=15){onbGo(1);return}
  const h=$('onbCvHelp');if(h){h.textContent='בחר קובץ או הדבק לפחות כמה שורות מקורות החיים. אפשר גם להוסיף אחר כך.';h.style.color='var(--rose)'}}
function onbNext(){commitOnb();if(onbSingle){closeOnb();curPg==='settings'?renderSettings():renderProfile();toast(prof().key?'הסוכנים מחוברים':'נשמר')}else onbGo(1)}
function commitOnb(){const keep={cv:prof().cv,cvName:prof().cvName,ans:prof().ans||{}};S.profile=Object.assign({},onbDraft,keep);save();syncChrome()}
function finishOnb(pg){commitOnb();S.onboarded=true;save();closeOnb();goPage(pg);if(curPg===pg&&pg==='main')renderHome()}

/* ═════════ QUESTIONNAIRE — one question per screen ═════════ */
const isStudent=a=>a.status==='סטודנט/ית';
/* ערכות תחום: כל משתמש מקבל את התפקידים של התחום שלו (מראה של agent_core/profile.py) */
const SOFT_ROLES=['Backend','Frontend','Full-Stack','Data / BI','AI / ML','QA ואוטומציה','DevOps / Cloud','סייבר','Embedded'];
const PACKS={'פיתוח תוכנה':{field:['מדעי המחשב','הנדסת תוכנה','הנדסת חשמל או מחשבים','מערכות מידע','מדעי הנתונים או סטטיסטיקה','בוטקאמפ או לימוד עצמי','אחר'],roles:SOFT_ROLES,work:'בפיתוח'},
  'הנדסת מכונות':{field:['הנדסת מכונות','הנדסאי מכונות','הנדסת תעשייה וניהול','הנדסה אווירונאוטית','הנדסת חומרים','אחר'],
    roles:['תכנון מכני','ייצור ותהליכים','R&D ופיתוח מוצר','איכות','ניהול פרויקטים הנדסיים','סימולציות ו-CAE','אחזקה ותפעול','מערכות ואינטגרציה'],work:'בהנדסה'}};
const MECH_W=['solidworks','autocad','ansys','catia','creo','inventor','gd&t','cnc','mechanical engineering','הנדסת מכונות','תיכון מכני','fea','thermodynamics','שרטוט'],
  SOFT_W=['python','javascript','react','java','sql','developer','node','typescript','git','backend','frontend'];
function cvDomain(cv){const t=(cv||'').toLowerCase(),m=MECH_W.filter(w=>t.includes(w)).length,sw=SOFT_W.filter(w=>t.includes(w)).length;return m>=2&&m>=sw?'הנדסת מכונות':sw>=2?'פיתוח תוכנה':''}
function domainOf(a){return a.domain||cvDomain(prof().cv)||'פיתוח תוכנה'}
function domKey(a){const d=domainOf(a);return d==='פיתוח תוכנה'?'software':d==='הנדסת מכונות'?'mechanical':'other'}
function pack(a){const d=domainOf(a);return PACKS[d]||(a.pack&&a.pack.label===d?{field:a.pack.field&&a.pack.field.length?a.pack.field:['אחר'],roles:a.pack.roles.map(r=>r.label),work:'בתחום'}:PACKS['פיתוח תוכנה'])}
async function buildPack(){const a=ans();if(!CLOUDM||!SB){toast('צריך חיבור לענן כדי לבנות ערכה לתחום שלך');return}
  $('onbBody').querySelector('.q-card')?.insertAdjacentHTML('afterend',`<p class="help" id="packWait" style="margin-top:12px">${escB(N('strategist'))} קורא את קורות החיים ובונה את רשימת התפקידים בתחום שלך…</p>`);
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:prof().cv||'',token:session&&session.access_token})});
    const d=await r.json();if(!r.ok||!d.roles)throw new Error(d.error||'x');
    a.pack=d;a.domain=d.label;a.roles=[];save();toast(`${N('strategist')}: התחום שלך הוא ${d.label}. בחר תפקידים בשאלה הבאה`);renderQ()}
  catch(e){const w=$('packWait');if(w)w.textContent='לא הצלחתי לבנות ערכה כרגע. אפשר לבחור תחום קרוב ולנסות שוב אחר כך.'}}
const QS=[
  {id:'status',t:'מה המצב שלך היום?',sub:'כך נדע אילו משרות להציג לך.',o:['סטודנט/ית','בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה','ג׳וניור עם ניסיון של עד שנתיים','עובד/ת ומחפש/ת לעבור','משתחרר/ת משירות','לא עובד/ת כרגע']},
  {id:'year',when:isStudent,t:'באיזו שנה אתה בתואר?',o:['שנה א׳','שנה ב׳','שנה ג׳','שנה ד׳','תואר שני']},
  {id:'track',when:isStudent,t:'מה אתה מחפש עכשיו?',o:['משרת סטודנט חלקית','משרה מלאה אחרי התואר','את שתיהן']},
  {id:'domain',t:'באיזה תחום אתה מחפש עבודה?',sub:'זיהינו מקורות החיים. אפשר לשנות.',o:a=>[...new Set(['פיתוח תוכנה','הנדסת מכונות',...(a.pack?[a.pack.label]:[]),'תחום אחר'])]},
  {id:'field',t:'מה הרקע המקצועי שלך?',o:a=>pack(a).field},
  {id:'roles',multi:true,t:'אילו תפקידים מעניינים אותך?',sub:'אפשר לבחור כמה.',o:a=>pack(a).roles},
  {id:'exp',t:a=>`כמה ניסיון מעשי יש לך ${pack(a).work}?`,sub:'כולל עבודה, התמחות או פרויקטים בתשלום.',o:['אין עדיין','פחות משנה','1–2 שנים','3–5 שנים','יותר מ-5 שנים']},
  {id:'age',t:'מה הגיל שלך?',sub:'עוזר להתאים לך משרות. לא מופיע במכתבים ולא נשלח למעסיקים.',o:['18–21','22–25','26–29','30–34','35 ומעלה','מעדיף/ה לא לציין']},
  {id:'army',t:'מה עשית בשירות?',sub:'בישראל זה חלק חשוב מקורות החיים, במיוחד בתחילת הדרך.',o:['שירות טכנולוגי (8200, ממר״ם וכד׳)','קרבי','קצונה או תפקיד פיקודי','שירות אחר','שירות לאומי','לא שירתתי']},
  {id:'locs',multi:true,t:'איפה נוח לך לעבוד?',sub:'אפשר לבחור כמה.',o:['תל אביב','גוש דן והמרכז','השרון','ירושלים','חיפה והצפון','באר שבע והדרום']},
  {id:'mode',t:'איך אתה מעדיף לעבוד?',o:['מהמשרד','היברידי','מהבית','לא משנה לי']},
  {id:'start',t:'מתי אתה יכול להתחיל?',o:['מיד','תוך חודש','בעוד 2–3 חודשים','אחרי התואר']},
  {id:'salaryH',when:a=>isStudent(a)&&a.track==='משרת סטודנט חלקית',t:'כמה שכר לשעה אתה מצפה?',o:['עד ₪45','₪45–55','₪55–65','₪65 ומעלה','עוד לא יודע']},
  {id:'salary',when:a=>!(isStudent(a)&&a.track==='משרת סטודנט חלקית'),t:'מה ציפיות השכר שלך?',sub:'ברוטו לחודש, במשרה מלאה.',o:['עד ₪12K','₪12–16K','₪16–20K','₪20–25K','₪25K ומעלה','עוד לא יודע']},
  {id:'english',t:'מה רמת האנגלית שלך?',o:['שפת אם','שוטפת','טובה','בסיסית']},
  {id:'prio',multi:true,max:2,t:'מה הכי חשוב לך בעבודה הבאה?',sub:'עד 2 דברים.',o:['למידה וחניכה','שכר','טכנולוגיות מעניינות','סטארט-אפ קטן','חברה גדולה ויציבה','קרוב לבית','גמישות בשעות']},
];
let qi=0;
const ans=()=>(prof().ans=prof().ans||{});
const visibleQs=()=>{const a=ans();if(!a.domain){const d=cvDomain(prof().cv);if(d)a.domain=d}return QS.filter(q=>!q.when||q.when(a)).map(q=>({...q,o:typeof q.o==='function'?q.o(a):q.o,t:typeof q.t==='function'?q.t(a):q.t}))};
const qTotal=()=>visibleQs().length+(ans().status?0:2);
const answered=q=>{const v=ans()[q.id];return q.multi?Array.isArray(v)&&v.length>0:!!v};
function qProgress(){const v=visibleQs();return{done:v.filter(answered).length,total:v.length}}
function openQuestions(at){if(typeof at==='string')at=visibleQs().findIndex(q=>q.id===at);
  const v=visibleQs();qi=at!=null?at:Math.max(0,v.findIndex(q=>!answered(q)));if(qi<0)qi=0;
  onbSingle=S.onboarded;onbStep=2;onbDraft=JSON.parse(JSON.stringify(prof()));closeSheet();closeDrawer();$('onb').classList.add('open');renderOnb();
}
function renderQ(){
  const v=visibleQs();
  if(qi>=v.length){qDone();return}
  $('onb').classList.add('qmode');
  const q=v[qi],a=ans(),cur=a[q.id];
  const sel=o=>q.multi?(Array.isArray(cur)&&cur.includes(o)):cur===o;
  $('onbBody').innerHTML=`
    <div class="q-top"><button class="q-back" aria-label="חזרה" onclick="qBack()"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      <div class="q-prog" aria-hidden="true"><i style="width:${Math.round(qi/Math.max(v.length,qTotal())*100)}%"></i></div>
      <button class="q-later" onclick="qLater()">המשך אחר כך</button></div>
    <div class="q-count num">שאלה ${qi+1} מתוך ${Math.max(v.length,qTotal())}</div>
    <h1 class="q-title">${escB(q.t)}</h1>${q.sub?`<p class="q-sub">${escB(q.sub)}</p>`:''}
    <div class="q-card" role="${q.multi?'group':'radiogroup'}" aria-label="${escB(q.t)}">${q.o.map((o,i)=>`<button class="q-opt${sel(o)?' sel':''}" role="${q.multi?'checkbox':'radio'}" aria-checked="${sel(o)}" onclick="qPick(${i})"><span>${escB(o)}</span><span class="${q.multi?'cb':'rd'}"></span></button>`).join('')}</div>`;
  $('onbFoot').innerHTML=q.multi
    ?`<button class="btn btn-primary btn-block" ${answered(q)?'':'disabled'} onclick="qNext()">המשך</button><button class="link-btn" onclick="qNext()">דלג על השאלה</button>`
    :`<button class="link-btn" onclick="qNext()">${cur?'המשך':'דלג על השאלה'}</button>`;
  $('onbBody').scrollTop=0;
}
let qLock=false;
function qPick(i){
  if(qLock)return;
  const q=visibleQs()[qi],o=q.o[i],a=ans();
  if(q.multi){let arr=Array.isArray(a[q.id])?a[q.id]:[];
    if(arr.includes(o))arr=arr.filter(x=>x!==o);else{if(q.max&&arr.length>=q.max)arr=arr.slice(1);arr=[...arr,o]}
    a[q.id]=arr;save();renderQ();return}
  if(q.id==='domain'&&o==='תחום אחר'){a.domain='';save();buildPack();return}
  if(q.id==='domain'&&a.domain!==o){a.roles=[];a.field=''}
  a[q.id]=o;save();
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

