/* ═════════ הגשות ═════════ */
let trFilter='all';
function inSeg(a,k){return k==='all'||(k==='closed'?CLOSED.includes(a.status):a.status===k)}
function appSub(a){const d=daysSince(a.date);
  return a.status==='saved'?`שמרת ${agoTxt(d)}`:a.status==='interview'?`ראיון ${a.iv||'בתיאום'}`:a.status==='screening'?'מחכות לך שאלות סינון':a.status==='offer'?'קיבלת הצעה':CLOSED.includes(a.status)?STATUSES[a.status]:`הגשת ${agoTxt(d)}`}
function renderApps(){
  const cnt=k=>S.apps.filter(a=>inSeg(a,k)).length;
  if(trFilter!=='all'&&!cnt(trFilter)) trFilter='all';
  $('seg').innerHTML=SEGS.filter(([k])=>k==='all'||cnt(k)).map(([k,l])=>`<button class="chip${trFilter===k?' sel':''}" role="tab" aria-selected="${trFilter===k}" onclick="trFilter='${k}';renderApps()">${l} <b class="num">${cnt(k)}</b></button>`).join('');
  const list=S.apps.filter(a=>inSeg(a,trFilter));
  if(!list.length){$('appsList').innerHTML=`<div class="empty"><div class="empty-ic">📋</div><h3>עוד אין כאן משרות</h3><p>משרות שתשמור יגיעו לכאן, עם מכתב פנייה מוכן.</p><button class="btn btn-primary" onclick="goPage('jobs')">למשרות החדשות</button></div>`;return}
  const order={interview:0,screening:1,offer:2,saved:3,applied:4,rejected:5,ghosted:6,withdrew:7};
  $('appsList').innerHTML=list.slice().sort((x,y)=>order[x.status]-order[y.status]).map(a=>{
    const j=JOBS[a.jobId],fu=followDue(a);
    return`<article class="app glass">
      <button class="app-top" style="width:100%;text-align:right" onclick="openApp('${a.id}')" aria-label="${escB(j.title)} ב-${escB(j.co)}, ${STATUSES[a.status]}">
        ${logo(j)}<span class="app-info"><span class="app-title" lang="en" dir="ltr" style="display:block;text-align:right">${escB(j.title)}</span><span class="app-sub" style="display:block">${escB(j.co)} · ${escB(appSub(a))}</span></span>
        <span class="status st-${a.status}">${STATUSES[a.status]}</span></button>
      ${fu?`<div class="follow"><span>${daysSince(a.date)} ימים בלי תשובה. הודעה קצרה עכשיו מעלה את הסיכוי לתגובה.</span><button class="btn btn-sm btn-ghost" onclick="openApp('${a.id}','details')">להודעה</button></div>`:''}
      ${a.status==='saved'?`<div class="app-actions"><button class="btn btn-sm btn-ghost" onclick="openApp('${a.id}','letter')">למכתב</button><button class="btn btn-sm btn-primary" onclick="markApplied('${a.id}')">הגשתי</button></div>`:''}
      ${a.status==='interview'||a.status==='screening'?`<div class="app-actions"><button class="btn btn-sm btn-primary" onclick="openApp('${a.id}','prep')">${a.status==='interview'?'להכנה לראיון':'לשאלות הסינון'}</button></div>`:''}
    </article>`}).join('');
}
function markApplied(id){const a=appOf(id);a.status='applied';a.date=new Date().toISOString();save();refreshApps();toast('סימנתי שהגשת. אזכיר לך לשלוח הודעת המשך בעוד שבוע')}
function refreshApps(){if(curPg==='apps')renderApps();if(curPg==='main')renderHome();syncChrome()}

/* application sheet: details · letter · referrals · prep */
let appTab='details';
function openApp(id,tab){
  const a=appOf(id);if(!a)return;
  const hasPrep=a.status==='interview'||a.status==='screening';
  appTab=tab==='prep'&&!hasPrep?'details':(tab||'details');
  const j=JOBS[a.jobId];
  const tabs=[['details','פרטים'],['letter','מכתב'],['ref','ממליצים'],...(hasPrep?[['prep',a.status==='interview'?'הכנה':'סינון']]:[])];
  openSheet(`<div style="display:flex;gap:13px;align-items:center">${logo(j)}<div style="min-width:0"><h3 id="sheetTitle" lang="en" dir="ltr" style="text-align:right">${escB(j.title)}</h3><div class="sheet-sub">${escB(j.co)} · ${escB(j.loc)}</div></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" id="tab-${k}" aria-selected="${appTab===k}" onclick="appTab='${k}';paintAppTab('${id}')">${l}</button>`).join('')}</div>
    <div id="appTab" role="tabpanel"></div>`);
  paintAppTab(id);
}
function paintAppTab(id){
  const a=appOf(id),j=JOBS[a.jobId],el=$('appTab');
  document.querySelectorAll('.tabs [role=tab]').forEach(b=>b.setAttribute('aria-selected',b.id==='tab-'+appTab));
  el.setAttribute('aria-labelledby','tab-'+appTab);
  if(appTab==='details'){
    const fu=followDue(a);
    el.innerHTML=`<div class="s-sec" style="margin-top:12px">
        <div class="kv"><span>שלב</span><button class="status st-${a.status}" onclick="openStatus('${id}')">${STATUSES[a.status]} · שינוי</button></div>
        <div class="kv"><span>${a.status==='saved'?'נשמרה':'הוגשה'}</span><b>${agoTxt(daysSince(a.date))}</b></div>
        ${a.iv?`<div class="kv"><span>ראיון</span><b>${escB(a.iv)}</b></div>`:''}
        <div class="kv"><span>התאמה</span><b class="num">${j.fit.toFixed(1)} מתוך 5</b></div>
        <div class="kv"><span>שכר</span><b>${escB(salaryTxt(j))}</b></div></div>
      ${fu?`<div class="s-sec"><h4>הודעת המשך</h4><textarea class="textbox" id="fuText" rows="7" aria-label="הודעת המשך">${esc(a.follow||followText(j))}</textarea>
        <div class="duo"><button class="btn btn-ghost" onclick="copyText($('fuText').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><button class="btn btn-primary" onclick="sentFollow('${id}')">שלחתי</button></div></div>`:''}
      <div class="s-sec"><a class="btn btn-ghost btn-block ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener">פתח את המשרה${ICO.open}</a></div>`;
  }else if(appTab==='letter'){
    el.innerHTML=`<div class="s-sec" style="margin-top:12px"><label for="letterBox" class="vh">מכתב פנייה</label><textarea class="textbox" id="letterBox" rows="13" oninput="appOf('${id}').letter=this.value;save()">${esc(a.letter||letterFor(j))}</textarea>
      <div class="hint-line ok">✓ מבוסס רק על מה שכתבת בקורות החיים</div>
      <div class="duo"><button class="btn btn-ghost" onclick="copyText($('letterBox').value,'המכתב הועתק')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener" onclick="copyText($('letterBox').value,'המכתב הועתק. הדבק אותו בטופס')">פתח את המשרה${ICO.open}</a></div>
      ${a.status==='saved'?`<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="markApplied('${id}');closeSheet()">הגשתי</button>`:''}</div>`;
  }else if(appTab==='ref'){
    const refs=REFERRALS[a.jobId]||[];
    el.innerHTML=refs.length?`<p style="font-size:13.5px;color:var(--ink2);margin:12px 0 4px">המלצה מבפנים מקפיצה מועמדות לראש הערימה. ${escB(N('researcher'))} מצא:</p>`+refs.map((r,i)=>`
      <div class="person">${pav(r.name)}<div class="tx"><b>${escB(r.name)}</b><span>${escB(r.role)}</span><span class="why">${escB(r.why)}</span></div></div>
      <label for="ref${i}" class="vh">הודעה ל${escB(r.name)}</label><textarea class="textbox" id="ref${i}" rows="5">${esc(refNote(r,j))}</textarea>
      <div class="duo"><button class="btn btn-ghost" onclick="copyText($('ref${i}').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${liSearch(r.name+' '+j.co)}" target="_blank" rel="noopener" onclick="copyText($('ref${i}').value,'ההודעה הועתקה. הדבק אותה בהודעה')">פתח בלינקדאין${ICO.open}</a></div>`).join('')
      :`<div class="empty" style="padding:28px 8px"><h3>עוד לא מצאנו קשר בחברה</h3><p>${escB(N('researcher'))} ימשיך לחפש אנשים מ-HIT, מהשירות ומהקשרים שלך.</p></div>`;
  }else{
    const P=PREP[a.status];
    el.innerHTML=`<p style="font-size:13.5px;color:var(--ink2);margin:12px 0 6px">${escB(P.lead)}</p>
      <div class="card-solid" style="padding:4px 14px">${P.qs.map(q=>`<details class="q"><summary><span class="qtag" lang="en">${escB(q.tag)}</span><span class="qtxt">${escB(q.q)}</span></summary><div class="hint">${q.h}</div></details>`).join('')}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="closeSheet();toggleChat(true);chatAsk('בוא נתרגל ${a.status==='interview'?'ראיון':'שאלות סינון'}')">לתרגל עם ${escB(N('coach'))}</button>`;
  }
}
function sentFollow(id){const a=appOf(id);a.follow=$('fuText').value;a.date=new Date().toISOString();save();closeSheet();refreshApps();toast('מעולה. אזכיר שוב בעוד שבוע אם לא יענו')}
function openStatus(id){
  const a=appOf(id),j=JOBS[a.jobId];
  openSheet(`<h3 id="sheetTitle">שלב ההגשה</h3><div class="sheet-sub">${escB(j.co)}</div><div class="s-sec" role="radiogroup" aria-label="שלב">${Object.entries(STATUSES).map(([k,l])=>`<button class="opt${a.status===k?' sel':''}" role="radio" aria-checked="${a.status===k}" onclick="setStatus('${id}','${k}')"><span class="status st-${k}">${l}</span><span class="radio" aria-hidden="true"></span></button>`).join('')}</div>`);
}
function setStatus(id,k){const a=appOf(id);if(a.status!==k){a.status=k;if(k==='applied')a.date=new Date().toISOString();save()}refreshApps();openApp(id,(k==='interview'||k==='screening')?'prep':'details');toast(`השלב עודכן: ${STATUSES[k]}`)}

/* ═════════ LinkedIn ═════════ */
function renderLinkedIn(){
  const L=S.li, c=Math.min(L.comments,WEEK_GOAL.comments), sc=liScore();
  $('liScroll').innerHTML=`
    <section class="li-head glass" aria-labelledby="goalH">
      <span class="ring" style="--p:${Math.round(c/WEEK_GOAL.comments*100)}" aria-hidden="true"><b class="num">${c}/${WEEK_GOAL.comments}<small>תגובות</small></b></span>
      <span class="tx"><b id="goalH">היעד שלך השבוע</b><span>${c>=WEEK_GOAL.comments?'השגת את יעד התגובות. כל הכבוד':'5 תגובות טובות ופוסט אחד. תגובה טובה שווה יותר מעשרות לייקים'}</span>
        <span class="li-goal-line">פוסט השבוע: ${L.posts?'<b>פורסם ✓</b>':'עוד לא'}</span></span>
    </section>

    <div class="sec-h"><h2>פוסטים חמים</h2><span>מהיומיים האחרונים</span></div>
    ${POSTS.map(postCard).join('')}

    <div class="sec-h" id="liFixes"><h2>הפרופיל שלך</h2><span class="num">${sc} מתוך 100</span></div>
    <section class="card-solid" aria-label="שיפורים לפרופיל">${LI_FIXES.map(fixRow).join('')}</section>

    <div class="sec-h"><h2>אנשים להכיר</h2><span>${PEOPLE.filter(p=>!L.people[p.id]).length} השבוע</span></div>
    <section class="card-solid" aria-label="אנשים להכיר">${PEOPLE.map(personRow).join('')}</section>

    <div class="sec-h"><h2>הפוסט של השבוע</h2><span>${L.posts?'פורסם ✓':'טיוטה'}</span></div>
    <section class="card-solid"><label for="postDraft" class="vh">טיוטת פוסט</label><textarea class="textbox" id="postDraft" rows="10" oninput="S.li.postText=this.value;save()">${esc(L.postText||POST_DRAFT)}</textarea>
      <div class="duo"><button class="btn btn-ghost" onclick="copyText($('postDraft').value,'הפוסט הועתק')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${LI_URL}feed/" target="_blank" rel="noopener" onclick="copyText($('postDraft').value,'הפוסט הועתק. הדבק אותו בפוסט חדש')">פתח את LinkedIn${ICO.open}</a></div>
      <div class="done-row" style="margin-top:10px"><span>פרסמת?</span><button class="mark" onclick="S.li.posts=S.li.posts?0:1;save();renderLinkedIn();syncChrome()">${L.posts?'בטל סימון':'פרסמתי ✓'}</button></div></section>`;
}
function postCard(p){
  const L=S.li,h=L.handled[p.id],sel=L.drafts[p.id]??0,txt=L['edit_'+p.id]??p.drafts[sel].t;
  const fresh=p.mins<60?`לפני ${p.mins} דק׳`:`לפני ${Math.round(p.mins/60)} שעות`;
  return`<article class="post glass${h?' handled':''}" aria-label="פוסט של ${escB(p.author)}">
    <div class="post-top">${pav(p.author)}<div class="tx"><b>${escB(p.author)}</b><span>${escB(p.role)}</span></div><span class="fresh${p.mins<60?'':' old'}">${fresh}</span></div>
    <span class="why" style="align-self:flex-start;margin-top:-4px">${escB(p.why)}</span>
    <div class="post-text" lang="${p.lang}">${escB(p.text)}</div>
    ${h?`<div class="done-row"><span class="handled-tag">✓ הגבת לפוסט הזה</span><button class="mark" onclick="unhandle('${p.id}')">בטל</button></div>`:`
    <div class="drafts"><span class="drafts-h" id="dh-${p.id}">תגובה מוצעת · אפשר לערוך לפני שמעתיקים</span>
      <div class="tabs mini" role="radiogroup" aria-labelledby="dh-${p.id}">${p.drafts.map((d,i)=>`<button role="radio" aria-checked="${sel===i}" onclick="pickDraft('${p.id}',${i})">${escB(d.k)}</button>`).join('')}</div>
    </div>
    <label for="ed-${p.id}" class="vh">התגובה</label><textarea class="textbox${p.lang==='en'?' ltr':''}" id="ed-${p.id}" rows="5" oninput="S.li['edit_${p.id}']=this.value;save()">${esc(txt)}</textarea>
    <div class="duo"><button class="btn btn-ghost" onclick="copyText($('ed-${p.id}').value,'התגובה הועתקה')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${LI_URL}feed/" target="_blank" rel="noopener" onclick="copyText($('ed-${p.id}').value,'התגובה הועתקה. הדבק אותה מתחת לפוסט')">פתח את הפוסט${ICO.open}</a></div>
    <div class="done-row"><span>הגבת?</span><button class="mark" onclick="handle('${p.id}')">הגבתי ✓</button></div>`}
  </article>`;
}
function pickDraft(pid,i){S.li.drafts[pid]=i;delete S.li['edit_'+pid];save();const y=$('liScroll').scrollTop;renderLinkedIn();$('liScroll').scrollTop=y;$('ed-'+pid)?.focus({preventScroll:true})}
function handle(pid){S.li.handled[pid]=true;S.li.comments++;save();renderLinkedIn();syncChrome();toast(S.li.comments>=WEEK_GOAL.comments?'השגת את יעד התגובות של השבוע':`נספר. ${S.li.comments} מתוך ${WEEK_GOAL.comments} השבוע`)}
function unhandle(pid){delete S.li.handled[pid];S.li.comments=Math.max(0,S.li.comments-1);save();renderLinkedIn();syncChrome()}
function fixRow(f){const on=!!S.li.fixes[f.id];
  return`<div class="fix${on?' done':''}"><button class="chk${on?' on':''}" role="checkbox" aria-checked="${on}" aria-label="${escB(f.t)}" onclick="toggleFix('${f.id}')"></button>
    <div class="tx"><b>${escB(f.t)}</b><span>${escB(f.why)}</span>
      ${!on&&f.copy?`<div class="copybox" lang="en">${escB(f.copy)}</div><div class="duo"><button class="btn btn-sm btn-ghost" onclick="copyFix('${f.id}')">${ICO.copy}העתק</button><a class="btn btn-sm btn-primary ext" href="${LI_URL}in/me/" target="_blank" rel="noopener">פתח את הפרופיל${ICO.open}</a></div>`:''}
      ${!on&&!f.copy?`<div class="duo"><a class="btn btn-sm btn-ghost ext" href="${LI_URL}in/me/" target="_blank" rel="noopener">פתח את הפרופיל${ICO.open}</a></div>`:''}</div></div>`}
function copyFix(id){copyText(LI_FIXES.find(f=>f.id===id).copy,'הטקסט הועתק. הדבק אותו בפרופיל')}
function toggleFix(id){S.li.fixes[id]?delete S.li.fixes[id]:S.li.fixes[id]=true;save();renderLinkedIn();syncChrome();if(S.li.fixes[id])toast(`הפרופיל עלה ל-${liScore()} מתוך 100`)}
function personRow(p){const on=!!S.li.people[p.id];
  return`<div class="person" style="flex-wrap:wrap">${pav(p.name)}<div class="tx"><b>${escB(p.name)}</b><span>${escB(p.role)}</span><span class="why">${escB(p.why)}</span></div>${on?'<span class="handled-tag">✓ נשלח</span>':''}
    ${on?'':`<div style="flex-basis:100%"><label for="nt-${p.id}" class="vh">הודעת חיבור ל${escB(p.name)}</label><textarea class="textbox" id="nt-${p.id}" rows="4" maxlength="300">${esc(p.note)}</textarea>
    <div class="hint-line"><span class="num">${[...p.note].length}</span>/300 תווים</div>
    <div class="duo"><button class="btn btn-sm btn-ghost" onclick="copyText($('nt-${p.id}').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><a class="btn btn-sm btn-primary ext" href="${liSearch(p.name+' '+p.role.split(',').pop().trim())}" target="_blank" rel="noopener" onclick="copyText($('nt-${p.id}').value,'ההודעה הועתקה. הדבק אותה בבקשת החיבור')">פתח בלינקדאין${ICO.open}</a></div>
    <div class="done-row"><span>שלחת בקשת חיבור?</span><button class="mark" onclick="S.li.people['${p.id}']=1;save();renderLinkedIn();syncChrome()">שלחתי ✓</button></div></div>`}</div>`}

/* ═════════ Office: agent messages (below the workflow) ═════════ */
let omAll=false;
function renderOfficeMsgs(){
  const el=$('omList');if(!el)return;
  const list=omAll?UPDATES:UPDATES.slice(0,5);
  el.innerHTML=list.map((u,i)=>{const a=CAREER.agents[u.a];return`<button class="om-item" onclick="openAgSheet(${u.a})"><span class="om-face"><canvas id="om-${i}" width="96" height="96"></canvas></span><span class="om-tx"><b>${a.name}</b><i>${u.time}</i><p>${escB(u.body)}</p></span></button>`}).join('')
    +(UPDATES.length>5?`<button class="om-more" onclick="omAll=!omAll;renderOfficeMsgs()">${omAll?'הצג פחות':`הצג עוד ${UPDATES.length-5}`}</button>`:'');
  list.forEach((u,i)=>face($('om-'+i),u.a));
}
