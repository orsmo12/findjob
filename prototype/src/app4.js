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
      <div class="duo"><label for="cvFile" class="btn btn-sm btn-ghost">${p.cvName?'להחליף קובץ':'להעלות קובץ'}</label><button class="btn btn-sm btn-ghost" onclick="editCvText()">לערוך כטקסט</button></div></section>

    <section class="card glass" aria-labelledby="qH"><h2 class="card-h" id="qH">עליי</h2>
      <div class="card-sub">${done<total?`ענית על ${done} מתוך ${total} שאלות. כל תשובה עוזרת לסוכנים לדייק.`:'ענית על כל השאלות. אפשר לעדכן בכל רגע.'}</div>
      <div class="quota-bar" style="margin-bottom:6px" aria-hidden="true"><div class="quota-fill" style="width:${Math.round(done/total*100)}%;background:linear-gradient(90deg,var(--brand2),var(--brand-hi))"></div></div>
      <button class="row" onclick="openQuestions('status')"><span class="ri">${ROW_IC.target}</span><span class="rl"><b>${escB(a.status||'מצב תעסוקתי')}</b><span>${escB([a.year,a.track,a.exp&&('ניסיון: '+a.exp)].filter(Boolean).join(' · ')||'עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="openQuestions('roles')"><span class="ri">${ROW_IC.doc}</span><span class="rl"><b lang="en">${escB((a.roles||[]).join(', ')||'תפקידים')}</b><span>${escB(a.field||'רקע מקצועי: עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="openQuestions('locs')"><span class="ri">${ROW_IC.pin}</span><span class="rl"><b>${escB((a.locs||[]).join(', ')||'אזור עבודה')}</b><span>${escB([a.mode,a.start&&('התחלה: '+a.start)].filter(Boolean).join(' · ')||'עוד לא ענית')}</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="btn btn-sm ${done<total?'btn-primary':'btn-ghost'} btn-block" style="margin-top:8px" onclick="openQuestions()">${done<total?'להמשיך את השאלון':'לעבור על כל התשובות'}</button></section>

    <section class="card glass" id="planCard" aria-labelledby="plH"><h2 class="card-h" id="plH">מה מחפשים בשבילך</h2>
      <div class="card-sub">${escB(N('strategist'))} בנה את זה מקורות החיים ומהתשובות שלך, ומעדכן בכל שינוי.</div>
      <ul class="plan-list">${planWhy().map(w=>`<li>${escB(w)}</li>`).join('')}</ul>
      <h3 class="sub-h">חברות יעד</h3>
      <div class="card-sub">${escB(N('hunter'))} בודק אותן ישירות, בנוסף לחיפוש הפתוח בכל החברות.</div>
      <div class="learned">${targetCompanies().map(c=>`<span class="chip" title="${escB(c.why.join(' · '))}">${escB(c.name)}<button aria-label="להסיר את ${escB(c.name)}" onclick="removeTarget('${escB(c.name).replace(/'/g,"\\'")}')">×</button></span>`).join('')}</div>
      <div class="todo-foot" style="padding:12px 0 0;border:0"><label for="tgIn" class="vh">חברה להוספה</label><input id="tgIn" placeholder="להוסיף חברה" onkeydown="if(event.key==='Enter')addTarget()"><button class="btn btn-sm btn-ghost" onclick="addTarget()">הוסף</button></div>
      ${(S.targets&&(S.targets.added.length||S.targets.removed.length))?`<button class="link" style="font-size:13px;color:var(--brand);margin-top:8px" onclick="S.targets={added:[],removed:[]};save();renderProfile()">להחזיר לבחירה של ${escB(N('strategist'))}</button>`:''}</section>

    <section class="card glass" aria-labelledby="tmH"><h2 class="card-h" id="tmH">הצוות שלי</h2>
      <div class="card-sub">אפשר לתת לכל סוכן שם אחר. התפקיד נשאר אותו תפקיד.</div>
      ${CAREER.agents.map((g,i)=>`<div class="row tm-row"><span class="tm-face" aria-hidden="true"><canvas id="tm-${i}" width="96" height="96"></canvas></span>
        <span class="rl"><label for="tmn-${i}" class="vh">השם של ${escB(g.role)}</label><input class="tm-in" id="tmn-${i}" value="${escB(g.name)}" maxlength="14" autocomplete="off" onchange="renameAgent('${g.key}',this.value)" onkeydown="if(event.key==='Enter')this.blur()"><span>${escB(g.role)}</span></span>
        <button class="tm-info" aria-label="מה ${escB(g.name)} עושה" onclick="openAgSheet(${i})">?</button></div>`).join('')}
      ${Object.keys(S.team).length?`<button class="btn btn-sm btn-ghost btn-block" style="margin-top:8px" onclick="S.team={};save();applyTeam();renderProfile();syncChrome();toast('השמות חזרו לברירת המחדל')">לשמות המקוריים</button>`:''}</section>

    <section class="card glass" aria-labelledby="stH"><h2 class="card-h" id="stH">בנק סיפורים לראיונות</h2>
      <div class="card-sub">סיפורים אמיתיים שלך בשיטת STAR. ${escB(N('coach'))} משתמשת בהם כשהיא מכינה אותך לראיון.</div>
      ${S.stories.map(st=>`<button class="row" onclick="editStory('${st.id}')"><span class="ri">${ROW_IC.book}</span><span class="rl"><b>${escB(st.t)}</b><span>${/תוצאה: *$/.test(st.b)?'חסרה התוצאה':'מוכן'}</span></span><span class="chev" aria-hidden="true"></span></button>`).join('')}
      <button class="btn btn-sm btn-ghost btn-block" style="margin-top:8px" onclick="editStory()">להוסיף סיפור</button></section>

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
    <div class="duo">${id?`<button class="btn btn-ghost" onclick="S.stories=S.stories.filter(x=>x.id!=='${id}');save();closeSheet();renderProfile();toast('הסיפור נמחק')">מחיקה</button>`:''}<button class="btn btn-primary" style="flex:2" onclick="saveStory('${id}')">שמירה</button></div>`);
}
function saveStory(id){const t=$('stT').value.trim(),b=$('stB').value;if(!t){$('stT').focus();toast('צריך כותרת לסיפור');return}
  if(id){Object.assign(S.stories.find(x=>x.id===id),{t,b})}else S.stories.push({id:'s'+Date.now(),t,b});save();closeSheet();renderProfile();toast('הסיפור נשמר')}
function editCvText(){openSheet(`<h3 id="sheetTitle">קורות חיים כטקסט</h3><div class="sheet-sub">הסוכנים עובדים לפי הטקסט הזה</div><div class="field" style="margin-top:14px"><label for="cvEdit" class="vh">קורות חיים</label><textarea id="cvEdit" rows="12">${esc(prof().cv)}</textarea></div><button class="btn btn-primary btn-block" onclick="prof().cv=$('cvEdit').value;save();closeSheet();renderProfile();toast('קורות החיים נשמרו')">שמירה</button>`)}
function onCvFile(inp){
  const f=inp.files[0];if(!f)return;prof().cvName=f.name;
  if(/\.(txt|md)$/i.test(f.name)){const r=new FileReader();r.onload=()=>{prof().cv=String(r.result).slice(0,20000);save();afterCv()};r.readAsText(f)}else{save();afterCv()}
  inp.value='';
}
function afterCv(){if($('onb').classList.contains('open'))renderOnb();else{renderProfile();toast('קורות החיים עודכנו')}}

/* ═════════ הגדרות ═════════ */
function renderSettings(){
  const p=prof();
  $('setScroll').innerHTML=`
    <section class="card glass" aria-labelledby="aiH"><h2 class="card-h" id="aiH">הסוכנים</h2>
      ${p.key?`<div class="ok-line">הסוכנים מחוברים ועובדים</div>`:`<div class="warn-line">הסוכנים עוד לא מחוברים</div><div class="card-sub" style="margin:6px 0 0">עד שתחבר, מוצגות דוגמאות.</div>`}
      <button class="btn btn-sm ${p.key?'btn-ghost':'btn-primary'} btn-block" style="margin-top:12px" onclick="openOnb(3)">${p.key?'להחליף מפתח':'לחבר עכשיו'}</button></section>

    <section class="card glass" aria-labelledby="ntH"><h2 class="card-h" id="ntH">התראות</h2>
      <div class="row"><span class="ri">${ROW_IC.bell}</span><span class="rl"><b id="nb">בריף בוקר</b><span>כל יום ב-08:00, הודעה אחת עם מה שחשוב</span></span><button class="switch${S.notif?' on':''}" role="switch" aria-checked="${S.notif}" aria-labelledby="nb" onclick="S.notif=!S.notif;save();renderSettings()"></button></div></section>

    <section class="card glass" aria-labelledby="gnH"><h2 class="card-h" id="gnH">כללי</h2>
      <div class="row"><span class="ri">${ROW_IC.globe}</span><span class="rl"><b>שפה</b><span>עברית</span></span></div>
      <button class="row" onclick="openOnb(0)"><span class="ri">${ROW_IC.replay}</span><span class="rl"><b>להתחיל את ההיכרות מחדש</b><span>קורות חיים, שאלון וחיבור</span></span><span class="chev" aria-hidden="true"></span></button>
      <button class="row" onclick="confirmWipe()"><span class="ri">${ROW_IC.trash}</span><span class="rl"><b class="danger">למחוק את כל הנתונים שלי</b><span>קורות חיים, משרות, מכתבים ומפתח</span></span></button></section>
    <p style="text-align:center;font-size:12px;color:var(--ink3)">findjob · גרסה 0.2</p>`;
}
function confirmWipe(){openSheet(`<h3 id="sheetTitle">למחוק את כל הנתונים?</h3><div class="sheet-sub">קורות החיים, המשרות, המכתבים והמפתח יימחקו מהמכשיר. אי אפשר לשחזר.</div><div class="duo" style="margin-top:20px"><button class="btn btn-ghost" onclick="closeSheet()">ביטול</button><button class="btn" style="background:var(--rose);color:#fff" onclick="LS.clear();location.reload()">למחוק הכל</button></div>`)}

/* ═════════ chat with the assistant ═════════ */
let chatOpen=false;
const SUGS=['מה כדאי לעשות היום?','איזו משרה הכי מתאימה לי?','בוא נתרגל ראיון'];
function toggleChat(force){
  chatOpen=force===true?true:!chatOpen;$('chatPop').classList.toggle('open',chatOpen);
  $('chatName').textContent=N('assistant');
  if(chatOpen){if(!$('chatMsgs').children.length)addMsg('bot',`היי ${prof().first}, אני ${N('assistant')}. אני עוקב אחרי מה שכל הצוות עושה. במה לעזור?`);
    $('chatSugs').innerHTML=SUGS.map(s=>`<button onclick="chatAsk('${s}')">${s}</button>`).join('');face($('chatFace'),5);setTimeout(()=>$('chatInput').focus(),260)}
}
function addMsg(who,text){const d=document.createElement('div');d.className='msg '+who;d.textContent=text;$('chatMsgs').appendChild(d);$('chatMsgs').scrollTop=1e6}
function chatAsk(t){$('chatInput').value=t;sendChat()}
function sendChat(){
  const v=$('chatInput').value.trim();if(!v)return;addMsg('me',v);$('chatInput').value='';
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
