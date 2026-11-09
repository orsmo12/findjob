/* ═════════ הפרופיל שלי ═════════ */
const ROW_IC={doc:'<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>',
  target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  bolt:'<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  bell:'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 00-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
  globe:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
  replay:'<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/></svg>'};
function learnedChips(){const c={};Object.values(S.skipReasons).forEach(r=>c[r]=(c[r]||0)+1);return Object.entries(c)}
function renderProfile(){
  const p=prof(),a=ans(),{done,total}=qProgress(),applied=S.apps.filter(x=>x.status!=='saved').length,ivs=S.apps.filter(x=>['interview','offer'].includes(x.status)).length,learned=learnedChips();
  const L={'בכירה מדי':'פחות משרות בכירות','מיקום':'משרות קרובות יותר','טכנולוגיה':'טכנולוגיות שמתאימות לך','לא מעניין אותי':'פחות תפקידים מהסוג שדילגת'};
  $('profScroll').innerHTML=`
    <div class="p-hero glass"><div class="avatar" aria-hidden="true">${escB(initials(p.first||p.name))}</div><h2 class="p-name">${escB(p.name)}</h2><div class="p-goal">${escB(goalTxt())}</div><button class="btn btn-sm btn-ghost" style="margin-top:12px" onclick="editMe()">עריכת שם</button>
      <div class="p-stats"><div><b class="num">${Object.keys(S.decisions).length}</b><span>משרות שסקרת</span></div><div><b class="num">${applied}</b><span>הגשות</span></div><div><b class="num">${ivs}</b><span>ראיונות</span></div></div></div>

    <section class="card glass" aria-labelledby="cvH"><h2 class="card-h" id="cvH">קורות חיים</h2>
      <div class="row"><span class="ri">${ROW_IC.doc}</span><span class="rl"><b>${escB(p.cvName||(p.cv?'הודבקו כטקסט':'עוד לא הועלו'))}</b><span>${p.cv||p.cvName?'כל הסוכנים עובדים לפיהם':'בלעדיהם הסוכנים לא יכולים להתאים לך משרות'}</span></span>${p.cv||p.cvName?'<span class="pill-ok">פעיל</span>':'<span class="pill-warn">חסר</span>'}</div>
      <div class="duo"><label for="cvFile" class="btn btn-sm btn-ghost">${p.cvName?'להחליף קובץ':'להעלות קובץ'}</label><button class="btn btn-sm btn-ghost" onclick="editCvText()">לערוך כטקסט</button></div>
      ${CLOUDM?`<div class="field" style="margin-top:12px"><label for="ghIn">שם המשתמש שלך ב-GitHub</label><div style="display:flex;gap:8px"><input id="ghIn" class="ltr" placeholder="username" value="${escB((p.ans||{}).github||'')}" autocomplete="off"><button class="btn btn-sm btn-ghost" onclick="saveGithub()">שמירה</button></div></div>`:''}
      ${typeof cvSuggestHtml==='function'?cvSuggestHtml():''}</section>
    <section class="card glass" aria-labelledby="kitH"><h2 class="card-h" id="kitH">פרטים לטפסי הגשה</h2>
      ${(()=>{const d=kitData(),miss=['phone','email','city','edu','auth'].filter(k=>!d[k]).length;return`<div class="card-sub">${miss?`חסרים ${miss} פרטים. איתם ערכת ההגשה ממלאת טפסים כמעט לבד.`:'מוכן. ערכת ההגשה ממלאת מהם טפסים.'}</div>
      <button class="btn btn-sm ${miss?'btn-primary':'btn-ghost'} btn-block" style="margin-top:8px" onclick="openKitEdit()">${miss?'להשלים פרטים':'לערוך'}</button>`})()}
      ${CLOUDM?`<button class="row" style="margin-top:8px" onclick="openLetterPrefs()"><span class="ri">${ROW_IC.doc}</span><span class="rl"><b>המצב שלי והמכתבים שכתבתי</b><span>${escB([(p.ans||{}).now?'המצב עודכן':'המצב: עוד לא כתבת',(S.my_letters||[]).length?`${S.my_letters.length} מכתבים שלך`:'בלי מכתבים לדוגמה'].join(' · '))}</span></span><span class="chev" aria-hidden="true"></span></button>`:''}</section>

    ${CLOUDM?`<section class="card glass" aria-labelledby="liH"><h2 class="card-h" id="liH">פרופיל LinkedIn</h2>
      <div class="field"><label for="liUrl">הקישור לפרופיל שלך</label><div style="display:flex;gap:8px"><input id="liUrl" class="ltr" type="url" placeholder="https://www.linkedin.com/in/…" value="${escB((p.ans||{}).linkedin||'')}" autocomplete="off"><button class="btn btn-sm btn-ghost" onclick="saveLinkedin()">שמירה</button></div></div>
      <div class="card-sub" style="margin-top:10px">${p.li_text?`${escB(N('linkedin'))} בודק את הפרופיל, והשיפורים במסך LinkedIn.`:`${escB(N('linkedin'))} יציע שיפורים לפרופיל אחרי שתעלה אותו.`} <button class="link" style="color:var(--brand);font-weight:600" onclick="liHow()">איך?</button></div>
      <label for="liFile" class="btn btn-sm ${p.li_text?'btn-ghost':'btn-primary'} btn-block">${p.li_text?'עדכנתי את הפרופיל':'להעלות את הפרופיל'}</label>
      <input type="file" id="liFile" class="vh" accept=".pdf,application/pdf" onchange="onLiFile(this)"></section>`:''}
    <section class="card glass" aria-labelledby="qH"><h2 class="card-h" id="qH">עליי</h2>
      <div class="card-sub">${done<total?`ענית על ${done} מתוך ${total} שאלות. כל תשובה עוזרת לסוכנים לדייק.`:'ענית על כל השאלות. אפשר לעדכן בכל רגע.'}</div>
      <div class="quota-bar" style="margin-bottom:6px" aria-hidden="true"><div class="quota-fill" style="width:${Math.round(done/total*100)}%;background:linear-gradient(90deg,var(--brand2),var(--brand-hi))"></div></div>
      <button class="row" onclick="openQuestions('status')"><span class="ri">${ROW_IC.target}</span><span class="rl"><b>${escB(a.status||'מצב תעסוקתי')}</b><span>${escB([a.year,a.track,a.exp&&('ניסיון: '+a.exp)].filter(Boolean).join(' · ')||'עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="openQuestions('roles')"><span class="ri">${ROW_IC.doc}</span><span class="rl"><b lang="en">${escB((a.roles||[]).join(', ')||'תפקידים')}</b><span>${escB(a.field||'רקע מקצועי: עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="openQuestions('locs')"><span class="ri">${ROW_IC.pin}</span><span class="rl"><b>${escB((a.locs||[]).join(', ')||'אזור עבודה')}</b><span>${escB([a.mode,a.start&&('התחלה: '+a.start)].filter(Boolean).join(' · ')||'עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="btn btn-sm ${done<total?'btn-primary':'btn-ghost'} btn-block" style="margin-top:8px" onclick="openQuestions()">${done<total?'להמשיך את השאלון':'לעבור על כל התשובות'}</button></section>

    <section class="card glass" id="planCard" aria-labelledby="plH">
      ${typeof suggestionsHtml==='function'?suggestionsHtml():''}
      <details class="plan-d"${S.planOpen?' open':''} ontoggle="S.planOpen=this.open">
      <summary><span><h2 class="card-h" id="plH">מה מחפשים בשבילך</h2><span class="plan-tags">${planTags().map(t=>`<i>${escB(t)}</i>`).join('')}</span>${planAlert()}</span><span class="chev" aria-hidden="true"></span></summary>
      <div class="card-sub">${escB(N('strategist'))} בנה את זה מקורות החיים ומהתשובות שלך, ומעדכן בכל שינוי.</div>
      <ul class="plan-list">${planWhy().map(w=>`<li>${escB(w)}</li>`).join('')}</ul>
      ${typeof lastMeeting==='function'&&lastMeeting()?`<button class="link" style="font-size:13px;color:var(--brand);margin:6px 0" onclick="openMeeting()">לדוח של הישיבה השבועית</button>`:''}
      <h3 class="sub-h">ערוצי טלגרם</h3>
      <div class="card-sub">${escB(N('hunter'))} קורא ערוצים ציבוריים של משרות, בלי חשבון.${(p.ans||{}).telegram&&p.ans.telegram.length?'':(domainOf(ans())==='פיתוח תוכנה'?' כרגע: hitechjobsjunior (ברירת מחדל).':'')}</div>
      <div class="learned">${((p.ans||{}).telegram||[]).map(c=>`<span class="chip" dir="ltr">${escB(c)}<button aria-label="להסיר את ${escB(c)}" onclick="rmChannel('${escB(c).replace(/'/g,"\\'")}')">×</button></span>`).join('')}</div>
      <div class="todo-foot" style="padding:8px 0 0;border:0"><label for="tgCh" class="vh">ערוץ טלגרם להוספה</label><input id="tgCh" class="ltr" placeholder="t.me/channel" onkeydown="if(event.key==='Enter')addChannel()"><button class="btn btn-sm btn-ghost" onclick="addChannel()">הוסף</button></div>
      <h3 class="sub-h">חברות יעד</h3>
      <div class="card-sub">כך ${escB(N('hunter'))} בדק אותן בסריקה האחרונה:</div>
      ${(()=>{const rt=realTargets();return rt?targetsHtml(rt):`<div class="learned">${targetCompanies().map(c=>`<span class="chip" title="${escB(c.why.join(' · '))}">${escB(c.name)}<button aria-label="להסיר את ${escB(c.name)}" onclick="removeTarget('${escB(c.name).replace(/'/g,"\\'")}')">×</button></span>`).join('')}</div>`})()}
      <div class="todo-foot" style="padding:12px 0 0;border:0"><label for="tgIn" class="vh">חברה להוספה</label><input id="tgIn" placeholder="להוסיף חברה" onkeydown="if(event.key==='Enter')addTarget()"><button class="btn btn-sm btn-ghost" onclick="addTarget()">הוסף</button></div>
      ${(S.targets&&(S.targets.added.length||S.targets.removed.length))?`<button class="link" style="font-size:13px;color:var(--brand);margin-top:8px" onclick="S.targets={added:[],removed:[]};save();renderProfile()">להחזיר לבחירה של ${escB(N('strategist'))}</button>`:''}</details></section>

    <section class="card glass" aria-labelledby="tmH"><h2 class="card-h" id="tmH">הצוות שלי</h2>
      <div class="card-sub">אפשר לתת לכל סוכן שם אחר. התפקיד נשאר אותו תפקיד.</div>
      ${CAREER.agents.map((g,i)=>`<div class="row tm-row"><span class="tm-face" aria-hidden="true"><canvas id="tm-${i}" width="96" height="96"></canvas></span>
        <span class="rl"><label for="tmn-${i}" class="vh">השם של ${escB(g.role)}</label><input class="tm-in" id="tmn-${i}" value="${escB(g.name)}" maxlength="14" autocomplete="off" onchange="renameAgent('${g.key}',this.value)" onkeydown="if(event.key==='Enter')this.blur()"><span>${escB(g.role)}</span></span>
        <button class="tm-info" aria-label="מה ${escB(g.name)} עושה" onclick="openAgSheet(${i})">?</button></div>`).join('')}
      ${Object.keys(S.team).length?`<button class="btn btn-sm btn-ghost btn-block" style="margin-top:8px" onclick="S.team={};save();applyTeam();renderProfile();syncChrome();toast('השמות חזרו לברירת המחדל')">לשמות המקוריים</button>`:''}</section>

    <section class="card glass" id="learned" aria-labelledby="lH"><h2 class="card-h" id="lH">מה למדנו עליך</h2>
      ${learned.length?`<div class="card-sub">מהמשרות שדילגת עליהן. אם משהו לא נכון, אפשר להסיר.</div><div class="learned">${learned.map(([r,n])=>`<span class="chip">${escB(L[r]||r)} <span class="num" style="color:var(--ink3)">(${n})</span><button aria-label="להסיר: ${escB(L[r]||r)}" onclick="forget('${r}')">×</button></span>`).join('')}</div>`
        :`<div class="card-sub" style="margin:0">כשתדלג על משרה ותגיד למה, נלמד ונסנן בהתאם. ${FILTERED_OUT} משרות בכירות מדי כבר סוננו לפי התשובות שלך.</div>`}</section>`;
  drawTeam();
}
function renameAgent(key,v){v=v.trim();const i=CAREER.agents.findIndex(a=>a.key===key);
  if(!v||v===TEAM_DEFAULT[i].name){delete S.team[key]}else S.team[key]=v;save();applyTeam();syncChrome();renderProfile();toast(`נשמר: ${N(key)}, ${AG(key).role}`)}
function editMe(){const p=prof();openSheet(`<h3 id="sheetTitle">השם שלך</h3><div class="sheet-sub">כך נפנה אליך באפליקציה ובמכתבים</div>
  <div class="field" style="margin-top:14px"><label for="meFirst">איך לקרוא לך</label><input id="meFirst" value="${escB(p.first)}" maxlength="20"></div>
  <div class="field"><label for="meFull">שם מלא, כמו במכתבים</label><input id="meFull" value="${escB(p.name)}" maxlength="40"></div>
  <button class="btn btn-primary btn-block" onclick="saveMe()">שמירה</button>`)}
function saveMe(){const f=$('meFirst').value.trim(),n=$('meFull').value.trim();if(!f){$('meFirst').focus();toast('צריך שם');return}prof().first=f;if(n)prof().name=n;save();closeSheet();syncChrome();renderProfile();toast('נשמר')}
function drawTeam(){CAREER.agents.forEach((g,i)=>face($('tm-'+i),i))}
function forget(r){Object.keys(S.skipReasons).forEach(k=>{if(S.skipReasons[k]===r)delete S.skipReasons[k]});save();renderProfile();toast('הוסר')}
function editStory(id){
  const st=id?S.stories.find(x=>x.id===id):{id:'',t:'',b:'מצב: \nמשימה: \nפעולה: \nתוצאה: '};
  openSheet(`<h3 id="sheetTitle">${id?'עריכת סיפור':'סיפור חדש'}</h3><div class="sheet-sub">מצב, משימה, פעולה ותוצאה. עדיף עם מספר אחד לפחות.</div>
    <div class="field" style="margin-top:14px"><label for="stT">כותרת</label><input id="stT" value="${escB(st.t)}" placeholder="למשל: Lifeboard, מגבלת API"></div>
    <div class="field"><label for="stB">הסיפור</label><textarea id="stB" rows="8">${esc(st.b)}</textarea></div>
    <div class="duo">${id?`<button class="btn btn-ghost" onclick="S.stories=S.stories.filter(x=>x.id!=='${id}');save();closeSheet();curPg==='prep'?renderPrep():renderProfile();toast('הסיפור נמחק')">מחיקה</button>`:''}<button class="btn btn-primary" style="flex:2" onclick="saveStory('${id}')">שמירה</button></div>`);
}
function saveStory(id){const t=$('stT').value.trim(),b=$('stB').value;if(!t){$('stT').focus();toast('צריך כותרת לסיפור');return}
  if(id){Object.assign(S.stories.find(x=>x.id===id),{t,b})}else S.stories.push({id:'s'+Date.now(),t,b});save();closeSheet();curPg==='prep'?renderPrep():renderProfile();toast('הסיפור נשמר')}
function editCvText(){openSheet(`<h3 id="sheetTitle">קורות חיים כטקסט</h3><div class="sheet-sub">הסוכנים עובדים לפי הטקסט הזה</div><div class="field" style="margin-top:14px"><label for="cvEdit" class="vh">קורות חיים</label><textarea id="cvEdit" rows="12">${esc(prof().cv)}</textarea></div><button class="btn btn-primary btn-block" onclick="prof().cv=$('cvEdit').value;save();closeSheet();renderProfile();toast('קורות החיים נשמרו')">שמירה</button>`)}
function onCvFile(inp){
  const f=inp.files[0];if(!f)return;prof().cvName=f.name;
  readCv(f).then(t=>{if(t&&t.trim().length>30)prof().cv=t.slice(0,20000);else toast('לא הצלחתי לקרוא טקסט מהקובץ. אפשר להדביק אותו כטקסט',{ms:4200});save();afterCv()});
  inp.value='';
}
/* קריאת קורות חיים בדפדפן: PDF (pdf.js), Word (mammoth), טקסט. הקובץ לא נשלח לשום מקום */
function loadScript(src){return new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)})}
async function readCv(f){try{
  if(/\.(txt|md)$/i.test(f.name))return await f.text();
  if(/\.pdf$/i.test(f.name)||f.type==='application/pdf'){
    const base='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';await loadScript(base+'pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js';
    const doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let out='';
    for(let i=1;i<=doc.numPages;i++){const c=await (await doc.getPage(i)).getTextContent();let y=null;
      for(const it of c.items){const ny=it.transform[5];if(y!==null&&Math.abs(ny-y)>3)out+='\n';else if(out&&!out.endsWith(' ')&&!out.endsWith('\n'))out+=' ';out+=it.str;y=ny}out+='\n'}
    return out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n')}
  if(/\.docx$/i.test(f.name)){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    return (await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value}
}catch(e){console.warn(e)}return''}
function openLetterPrefs(){const p=prof();
  openSheet(`<h3 id="sheetTitle">למכתבים של ${escB(N('assistant'))}</h3><div class="sheet-sub">${escB(N('assistant'))} כותב כל מכתב לפי המצב שלך היום, ובסגנון של מכתבים שכתבת. משתמשים רק בעובדות שלך.</div>
    <div class="field" style="margin-top:12px"><label for="lpNow">המצב שלי היום</label><textarea id="lpNow" class="textbox" rows="3" placeholder="למשל: מחכה לציון אחרון בתואר, ממוצע 85. זמין להתחיל מיד.">${esc((p.ans||{}).now||'')}</textarea>
      <div class="help">גובר על מה שכתוב בקורות החיים, כי הוא מתעדכן.</div></div>
    <div class="field"><label for="lpLet">מכתבים שכתבת ואהבת (עד 3)</label><textarea id="lpLet" class="textbox ltr" rows="9" dir="auto" placeholder="מדביקים מכתב. בין מכתב למכתב: שורה עם ---">${esc((S.my_letters||[]).join('\n---\n'))}</textarea>
      <div class="help">${escB(N('assistant'))} ילמד מהם את הסגנון שלך, וישתמש בפסקאות מהם כשהן נכונות למשרה.</div></div>
    <button class="btn btn-primary btn-block" onclick="saveLetterPrefs()">שמירה</button>`)}
function saveLetterPrefs(){const p=prof();p.ans=p.ans||{};p.ans.now=$('lpNow').value.trim();
  S.my_letters=$('lpLet').value.split(/\n\s*-{3,}\s*\n/).map(x=>x.trim()).filter(x=>x.length>80).slice(0,3);save();closeSheet();renderProfile();
  toast(`נשמר. המכתבים הבאים של ${N('assistant')} ייכתבו לפי זה`)}
function chName(v){const m=String(v||'').trim().match(/(?:t\.me\/(?:s\/)?|@)?([A-Za-z][A-Za-z0-9_]{3,31})\/?$/);return m?m[1]:''}
function addChannel(){const c=chName($('tgCh').value);if(!c){toast('צריך קישור לערוץ ציבורי, למשל t.me/hitechjobsjunior');return}
  const p=prof();p.ans=p.ans||{};p.ans.telegram=p.ans.telegram||[];if(!p.ans.telegram.includes(c))p.ans.telegram.push(c);save();renderProfile();toast(`${N('hunter')} יקרא את ${c} מהסריקה הבאה`)}
function rmChannel(c){const p=prof();p.ans.telegram=(p.ans.telegram||[]).filter(x=>x!==c);save();renderProfile()}
function liHow(){openSheet(`<h3 id="sheetTitle">איך ${escB(N('linkedin'))} קורא את הפרופיל</h3>
  <div class="sheet-sub">findjob לא נכנס לחשבון ה-LinkedIn שלך. ${escB(N('linkedin'))} קורא עותק שאתה שומר:</div>
  <ol class="how-ol"><li>בפרופיל שלך ב-LinkedIn לוחצים More (או "עוד")</li><li>בוחרים Save to PDF</li><li>כאן לוחצים ${prof().li_text?'"עדכנתי את הפרופיל"':'"להעלות את הפרופיל"'} ובוחרים את הקובץ</li></ol>
  <p class="card-sub">כל פעם שאתה משנה משהו בפרופיל, מעלים עותק חדש, ו${escB(N('linkedin'))} בודק שוב.</p>`)}
function onLiFile(inp){const f=inp.files[0];if(!f)return;readCv(f).then(t=>{if(t&&t.trim().length>80){prof().li_text=t.slice(0,15000);save();renderProfile();toast(`${N('linkedin')} יעבור על הפרופיל בשעתיים הקרובות`)}else toast('לא הצלחתי לקרוא את הקובץ. ודא שזה ה-PDF ש-LinkedIn מייצר',{ms:4200})});inp.value=''}
function afterCv(){if($('onb').classList.contains('open'))renderOnb();else{renderProfile();toast('קורות החיים עודכנו')}}

/* ═════════ הגדרות ═════════ */
function renderSettings(){
  const p=prof();
  $('setScroll').innerHTML=`
    ${CLOUDM&&typeof aiKeyCard==='function'?aiKeyCard():''}
    ${CLOUDM&&ME?`<section class="card glass" aria-labelledby="accH"><h2 class="card-h" id="accH">החשבון</h2><div class="card-sub" dir="ltr" style="text-align:right">${escB(ME.email||'')}</div><button class="btn btn-sm btn-ghost btn-block" style="margin-top:12px" onclick="cloudLogout()">יציאה</button></section>`:''}
    <section class="card glass" aria-labelledby="aiH"><h2 class="card-h" id="aiH">הסוכנים</h2>
      ${CLOUDM?`<div class="ok-line">הסוכנים מחוברים ורצים בענן</div><div class="card-sub" style="margin:6px 0 0">${N('hunter')} מחפש פעמיים ביום ובודק כל בוקר שהמשרות ששמרת עדיין פתוחות. ${N('assistant')}, ${N('researcher')} ו${N('coach')} מכינים מכתב, סקירה והכנה לכל משרה ששמרת, אחרי כל סריקה ועוד כמה פעמים ביום.</div>`:p.key?`<div class="ok-line">הסוכנים מחוברים ועובדים</div>`:`<div class="warn-line">הסוכנים עוד לא מחוברים</div><div class="card-sub" style="margin:6px 0 0">עד שתחבר, מוצגות דוגמאות.</div>`}
      <button class="btn btn-sm ${p.key?'btn-ghost':'btn-primary'} btn-block" style="margin-top:12px" onclick="openOnb(3)" ${CLOUDM?'hidden':''}>${p.key?'להחליף מפתח':'לחבר עכשיו'}</button></section>

    <section class="card glass" aria-labelledby="ntH"><h2 class="card-h" id="ntH">התראות</h2>
      <div class="row"><span class="ri">${ROW_IC.bell}</span><span class="rl"><b id="nb">משרות חדשות בטלפון</b><span>${CLOUDM?(S.push?'מופעל. הודעה אחת כש'+escB(N('hunter'))+' מוצא משרות חדשות':'הודעה אחת כש'+escB(N('hunter'))+' מוצא משרות חדשות. בלי מייל'):'זמין בגרסה המחוברת'}</span></span>${CLOUDM?`<button class="switch${S.push?' on':''}" role="switch" aria-checked="${!!S.push}" aria-labelledby="nb" onclick="pushToggle()"></button>`:''}</div>
      <div class="card-sub" style="margin-top:6px">בתוך האפליקציה: מספר על התפריט ובכותרת הלשונית כשיש משרות חדשות.</div></section>

    <section class="card glass" aria-labelledby="gnH"><h2 class="card-h" id="gnH">כללי</h2>
      <div class="row"><span class="ri">${ROW_IC.globe}</span><span class="rl"><b>שפה</b><span>עברית</span></span></div>
      <button class="row" onclick="openOnb(0)"><span class="ri">${ROW_IC.replay}</span><span class="rl"><b>להתחיל את ההיכרות מחדש</b><span>קורות חיים, שאלון וחיבור</span></span><span class="chev" aria-hidden="true"></span></button>
      <a class="row ext" href="/privacy.html" target="_blank" rel="noopener"><span class="ri">${ROW_IC.globe}</span><span class="rl"><b>פרטיות</b><span>מה נשמר, למה, ואיך מוחקים</span></span><span class="chev" aria-hidden="true"></span></a>
      <button class="row" onclick="tourStart()"><span class="ri">${ROW_IC.replay}</span><span class="rl"><b>סיור באפליקציה</b><span>דקה אחת, מה יש איפה</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="confirmWipe()"><span class="ri">${ROW_IC.trash}</span><span class="rl"><b class="danger">${CLOUDM?'למחוק את החשבון והנתונים שלי':'למחוק את כל הנתונים שלי'}</b><span>קורות חיים, משרות, מכתבים ומפתח</span></span></button></section>
    <p style="text-align:center;font-size:12px;color:var(--ink3)">findjob · גרסה 0.2</p>`;
}
function confirmWipe(){openSheet(`<h3 id="sheetTitle">${CLOUDM?'למחוק את החשבון והנתונים?':'למחוק את כל הנתונים?'}</h3><div class="sheet-sub">${CLOUDM?'החשבון, קורות החיים, המשרות, המכתבים וההיסטוריה יימחקו לצמיתות, מהענן ומהמכשיר.':'קורות החיים, המשרות, המכתבים והמפתח יימחקו מהמכשיר.'} אי אפשר לשחזר.</div><div class="duo" style="margin-top:20px"><button class="btn btn-ghost" onclick="closeSheet()">ביטול</button><button class="btn" style="background:var(--rose);color:#fff" onclick="${CLOUDM?'deleteAccount()':'LS.clear();location.reload()'}">למחוק הכל</button></div>`)}

/* ═════════ chat with the assistant ═════════ */
let chatOpen=false;
const SUGS=['מה כדאי לעשות היום?','איזו משרה הכי מתאימה לי?','בוא נתרגל ראיון'];
function toggleChat(force){
  chatOpen=force===true?true:!chatOpen;$('chatPop').classList.toggle('open',chatOpen);
  $('chatName').textContent=N('assistant');
  if(chatOpen){if(CLOUDM)renderChatHistory();if(!$('chatMsgs').children.length)addMsg('bot',`היי ${prof().first}, אני ${N('assistant')}. אני רואה את המשרות, ההגשות וההכנות שלך, ויכול גם לעדכן דברים באפליקציה, באישור שלך. במה לעזור?`);
    if(CLOUDM)chatSugs();else $('chatSugs').innerHTML=SUGS.map(s=>`<button onclick="chatAsk('${s}')">${s}</button>`).join('');face($('chatFace'),5);setTimeout(()=>$('chatInput').focus(),260)}
}
function addMsg(who,text){const d=document.createElement('div');d.className='msg '+who;d.textContent=text;$('chatMsgs').appendChild(d);$('chatMsgs').scrollTop=1e6}
function chatAsk(t){$('chatInput').value=t;sendChat()}
function sendChat(){
  const v=$('chatInput').value.trim();if(!v)return;addMsg('me',v);$('chatInput').value='';
  if(CLOUDM){cloudChat(v);return}
  const q=queue();let r;
  if(/היום|לעשות|כדאי/.test(v)){const n=nextSteps();r=n.length?'הכי חשוב עכשיו:\n'+n.slice(0,3).map((x,i)=>`${i+1}. ${x.b}`).join('\n'):'אין משהו דחוף. זה זמן טוב לעבור על בנק הסיפורים בפרופיל.'}
  else if(/מתאימ|משרה/.test(v)) r=q.length?`הכי חזקה כרגע: ${JOBS[q[0]].title} ב-${JOBS[q[0]].co}, התאמה ${JOBS[q[0]].fit} מתוך 5. ${JOBS[q[0]].reasons[0]}.`:'עברת על כל המשרות של היום. בהגשות יש משרות ששמרת ומחכות להגשה.';
  else if(/ראיון|תרגל|סינון/.test(v)) r='נתחיל. איך היית מתכנן מערכת התראות לבורד עם מיליון משתמשים? כתוב את הרכיבים הראשונים, ואני אגיב.';
  else r='רשמתי. ברגע שהסוכנים יהיו מחוברים, אענה מהנתונים האמיתיים שלך.';
  setTimeout(()=>addMsg('bot',r),550);
}

/* ═════════ init ═════════ */
function init(){
  syncChrome();
  goPage('main');
  setTimeout(()=>{$('splash').classList.add('hide');if(!S.onboarded)openOnb(0)},1100);
}

function saveLinkedin(){const v=($('liUrl').value||'').trim();const p=prof();p.ans=p.ans||{};
  if(v&&!/^https?:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(v)){toast('זה לא נראה כמו קישור לפרופיל LinkedIn');return}
  p.ans.linkedin=v;save();toast(v?'הקישור נשמר':'הקישור נמחק')}

/* ═════════ סיור באפליקציה (בסגנון TipKit): מצביע על הכפתורים האמיתיים ═════════ */
const TOUR=[
  {sel:'#menuBtn',t:'התפריט',d:'משרות, הגשות, LinkedIn והמשרד. המספרים אומרים מה מחכה לך.'},
  {sel:'.brief',t:'מה חדש',d:()=>`מה הסוכנים עשו ב-24 השעות האחרונות. משרות חדשות תמיד ראשונות.`},
  {sel:'.next',t:'הצעדים הבאים',d:'מה כדאי לעשות עכשיו, לפי סדר חשיבות. לחיצה מובילה ישר למקום.'},
  {sel:'#chatBtn',t:()=>`${N('assistant')} בצ׳אט`,d:'שואלים כל דבר: איזו משרה מתאימה, תרגול ראיון, או שאלה מטופס הגשה.'},
  {sel:'#tbAvatar',t:'הפרופיל שלך',d:'קורות חיים, פרטים לטפסים וחברות יעד. ככל שהוא מלא יותר, הסוכנים מדייקים יותר.'},
  {sel:'#menuBtn',t:'הכל אצלך',d:()=>`${N('hunter')} מחפש פעמיים ביום. אתה מחליק ימינה כדי לשמור משרה, והצוות מכין לה מכתב, סקירה והכנה. שום דבר לא נשלח בלי שתלחץ.`},
];
let tourI=-1;
function tourStart(){if(curPg!=='main')goPage('main');closeDrawer&&closeDrawer();tourI=0;setTimeout(tourShow,150)}
function tourEnd(){tourI=-1;S.tourDone=true;save();$('tour')&&$('tour').remove();document.removeEventListener('keydown',tourKey)}
function tourKey(e){if(e.key==='Escape')tourEnd();if(e.key==='ArrowLeft'||e.key==='Enter')tourNext();if(e.key==='ArrowRight'&&tourI>0){tourI--;tourShow()}}
function tourNext(){tourI++;tourI>=TOUR.length?tourEnd():tourShow()}
function tourShow(){
  const st=TOUR[tourI],el=document.querySelector(st.sel);if(!el){tourNext();return}
  el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  setTimeout(()=>{const r=el.getBoundingClientRect(),pad=6,vh=innerHeight,below=r.bottom+200<vh;
    let w=$('tour');if(!w){w=document.createElement('div');w.id='tour';document.body.appendChild(w);document.addEventListener('keydown',tourKey)}
    const v=x=>typeof x==='function'?x():x;
    w.innerHTML=`<div class="tour-hole" style="top:${r.top-pad}px;left:${r.left-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px"></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourT" style="${below?`top:${Math.min(r.bottom+14,vh-190)}px`:`bottom:${Math.max(vh-r.top+14,12)}px`}">
        <b id="tourT">${escB(v(st.t))}</b><p>${escB(v(st.d))}</p>
        <div class="tour-foot"><span class="tour-dots" aria-label="צעד ${tourI+1} מתוך ${TOUR.length}">${TOUR.map((_,i)=>`<i${i===tourI?' class="on"':''}></i>`).join('')}</span>
          <span><button class="btn btn-sm btn-ghost" onclick="tourEnd()">דלג</button><button class="btn btn-sm btn-primary" id="tourNext" onclick="tourNext()">${tourI===TOUR.length-1?'סיימתי':'הבא'}</button></span></div></div>`;
    $('tourNext').focus()},260)}
