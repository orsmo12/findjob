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
  if(!list.length){$('appsList').innerHTML=historyHtml(true)+`<div class="empty"><div class="empty-ic">📋</div><h3>עוד אין כאן משרות</h3><p>משרות שתשמור יגיעו לכאן, עם מכתב פנייה מוכן.</p><button class="btn btn-primary" onclick="goPage('jobs')">למשרות החדשות</button></div>`;return}
  const order={interview:0,screening:1,offer:2,saved:3,applied:4,rejected:5,ghosted:6,withdrew:7};
  const prepBtn=CLOUDM&&S.apps.some(a=>a.status==='saved')?`<button class="btn btn-sm btn-ghost btn-block" style="margin-bottom:10px" onclick="prepNow()">${ICO.spark||''}לעדכן הכל עכשיו</button>`:'';
  $('appsList').innerHTML=prepBtn+list.slice().sort((x,y)=>order[x.status]-order[y.status]).map(a=>{
    const j=JOBS[a.jobId],fu=followDue(a);
    return`<div class="swipe" data-id="${a.id}"><div class="swipe-bg" aria-hidden="true"><span>הסרה</span><span>הסרה</span></div><article class="app glass">${j.closed_at?`<div class="closed-tag">המשרה נסגרה למועמדים חדשים</div>`:''}
      <button class="app-top" style="width:100%;text-align:right" onclick="openApp('${a.id}')" aria-label="${escB(j.title)} ב-${escB(j.co)}, ${STATUSES[a.status]}">
        ${logo(j)}<span class="app-info"><span class="app-title" dir="${dirOf(j.title)||'auto'}" style="display:block;text-align:right">${escB(j.title)}</span><span class="app-sub" style="display:block">${escB(j.co)} · ${escB(appSub(a))}</span></span>
        <span class="status st-${a.status}">${STATUSES[a.status]}</span></button>
      ${fu?`<div class="follow"><span>${daysSince(a.date)} ימים בלי תשובה. הודעה קצרה עכשיו מעלה את הסיכוי לתגובה.</span><button class="btn btn-sm btn-ghost" onclick="openApp('${a.id}','details')">להודעה</button></div>`:''}
      ${a.status==='saved'||a.status==='applied'?`<div class="app-actions"><button class="btn btn-sm btn-ghost" onclick="openApp('${a.id}','letter')">לערכת ההגשה</button>${appliedBox(a)}</div>`:''}
      ${a.status==='interview'||a.status==='screening'?`<div class="app-actions"><button class="btn btn-sm btn-primary" onclick="${REAL?`openPrep('${a.jobId}')`:`openApp('${a.id}','prep')`}">${a.status==='interview'?'להכנה לראיון':'לשאלות הסינון'}</button></div>`:''}
    </article></div>`}).join('')+historyHtml();
  bindAppSwipes();
}
/* "הגשתי": ריבוע ריק, ו-✓ ירוק אחרי סימון. לחיצה שנייה מבטלת */
function appliedBox(a,wide){const on=a.status!=='saved';
  return `<button class="chk-btn${on?' on':''}${wide?' wide':''}" role="checkbox" aria-checked="${on}" onclick="${on?`unmarkApplied('${a.id}')`:`markApplied('${a.id}')`};${wide?'paintAppTab(\''+a.id+'\')':''}"><span class="box" aria-hidden="true">${on?'✓':''}</span>הגשתי</button>`}
function unmarkApplied(id){const a=appOf(id);if(!a||a.status!=='applied')return;a.status='saved';save();refreshApps();toast('ביטלתי את הסימון. המשרה חזרה ל"שמור"')}
function markApplied(id){track('applied');const a=appOf(id);a.status='applied';a.date=new Date().toISOString();save();refreshApps();toast('סימנתי שהגשת. אזכיר לך לשלוח הודעת המשך בעוד שבוע')}
function refreshApps(){if(curPg==='apps')renderApps();if(curPg==='main')renderHome();if(curPg==='jobs')renderJobs();syncChrome()}

/* application sheet: details · letter · referrals · prep */
let appTab='details';
function openApp(id,tab){
  const a=appOf(id);if(!a)return;
  const hasPrep=!REAL&&(a.status==='interview'||a.status==='screening');
  appTab=tab==='prep'&&!hasPrep?'details':(tab||'details');
  const j=JOBS[a.jobId];
  const tabs=[['details','פרטים'],['letter','ערכת הגשה'],['ref',REAL?'קשרים':'ממליצים'],...(hasPrep?[['prep',a.status==='interview'?'הכנה':'סינון']]:[])];
  openSheet(`<div style="display:flex;gap:13px;align-items:center">${logo(j)}<div style="min-width:0"><h3 id="sheetTitle" dir="${dirOf(j.title)||'auto'}" style="text-align:right">${escB(j.title)}</h3><div class="sheet-sub">${escB(j.co)} · ${escB(j.loc)}</div></div></div>
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
        <div class="kv"><span>שכר</span><b>${escB(salaryTxt(j))}</b></div>
        ${REAL&&a.status==='saved'?`<div class="kv"><span>פתוחה להגשה?</span><b>${openTxt(j)}</b></div>`:''}</div>
      ${fu?`<div class="s-sec"><h4>הודעת המשך</h4><textarea class="textbox" id="fuText" rows="7" aria-label="הודעת המשך">${esc(a.follow||followText(j))}</textarea>
        <div class="duo"><button class="btn btn-ghost" onclick="copyText($('fuText').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><button class="btn btn-primary" onclick="sentFollow('${id}')">שלחתי</button></div></div>`:''}
      ${REAL?briefHtml(j):''}
      ${REAL?prepEntry(a,j):''}
      ${REAL?tailorHtml(j):''}
      <div class="s-sec"><h4>עריכה</h4>
        <div class="field"><label for="edIv">מועד ראיון או שיחה</label><input id="edIv" value="${escB(a.iv||'')}" placeholder="למשל: רביעי, 14:00" onchange="appOf('${id}').iv=this.value.trim();save();refreshApps()"></div>
        <div class="field"><label for="edNote">הערות שלי</label><textarea id="edNote" class="textbox" rows="3" placeholder="עם מי דיברתי, מה ביקשו, מה הלאה…" oninput="$('edNoteBtn').disabled=this.value===(appOf('${id}').note||'')" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&matchMedia('(pointer:fine)').matches){event.preventDefault();saveNote('${id}')}">${esc(a.note||'')}</textarea>
          <div class="note-row"><span class="hint-line note-kb">Enter לשמירה · Shift+Enter לשורה חדשה</span><button class="btn btn-sm btn-primary" id="edNoteBtn" disabled onclick="saveNote('${id}')">שמירה</button></div></div></div>
      <div class="s-sec"><a class="btn btn-ghost btn-block ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener">פתח את המשרה${ICO.open}</a>
        ${CLOUDM?`<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="askAboutJob('${a.jobId}')">לשאול את ${escB(N('assistant'))} על המשרה</button>`:''}
                <button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--rose)" onclick="closeSheet();removeApp('${id}')">להסיר מההגשות</button></div>`;
  }else if(appTab==='letter'){
    el.innerHTML=kitTabHtml(a,j,id);
  }else if(appTab==='ref'&&REAL){
    el.innerHTML=refHtml(j,id);
  }else if(appTab==='ref'){
    const refs=REFERRALS[a.jobId]||[];
    el.innerHTML=refs.length?`<p style="font-size:13.5px;color:var(--ink2);margin:12px 0 4px">המלצה מבפנים מקפיצה מועמדות לראש הערימה. ${escB(N('researcher'))} מצא:</p>`+refs.map((r,i)=>`
      <div class="person">${pav(r.name)}<div class="tx"><b>${escB(r.name)}</b><span>${escB(r.role)}</span><span class="why">${escB(r.why)}</span></div></div>
      <label for="ref${i}" class="vh">הודעה ל${escB(r.name)}</label><textarea class="textbox" id="ref${i}" rows="5">${esc(refNote(r,j))}</textarea>
      <div class="duo"><button class="btn btn-ghost" onclick="copyText($('ref${i}').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${liSearch(r.name+' '+j.co)}" target="_blank" rel="noopener" onclick="copyText($('ref${i}').value,'ההודעה הועתקה. הדבק אותה בהודעה')">פתח בלינקדאין${ICO.open}</a></div>`).join('')
      :`<div class="empty" style="padding:28px 8px"><h3>עוד לא מצאנו קשר בחברה</h3><p>${escB(N('researcher'))} ימשיך לחפש אנשים מ-HIT, מהשירות ומהקשרים שלך.</p></div>`;
  }else if(REAL){
    const qs=j.prep&&j.prep.questions||[];
    el.innerHTML=!j.prep?`<div class="empty" style="padding:28px 8px"><h3>${escB(N('coach'))} מכינה שאלות</h3><p>השאלות נבנות לפי הדרישות במודעה ולפי קורות החיים שלך. הן יופיעו כאן תוך שעתיים בערך.</p></div>`
      :!qs.length?`<div class="empty" style="padding:28px 8px"><h3>לא היו מספיק פרטים במודעה</h3><p>אפשר לתרגל שאלות כלליות בצ׳אט.</p></div>`
      :`<p style="font-size:13.5px;color:var(--ink2);margin:12px 0 6px">שאלות סבירות לשיחה הראשונה, לפי מה שכתוב במודעה. לחץ על שאלה כדי לראות איך לבנות תשובה מתוך הניסיון שלך.</p>
      <div class="card-solid" style="padding:4px 14px">${qs.map(q=>`<details class="q"><summary><span class="qtag" dir="auto">${escB(q.tag)}</span><span class="qtxt">${escB(q.q)}</span></summary><div class="hint">${escB(q.h)}</div></details>`).join('')}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="closeSheet();toggleChat(true);chatAsk('בוא נתרגל ראיון ל-${escB(j.co)}')">לתרגל עם ${escB(N('coach'))}</button>`;
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
function setStatus(id,k){const a=appOf(id);if(a.status!==k){a.status=k;if(k==='applied')a.date=new Date().toISOString();save()}refreshApps();if(REAL&&(k==='interview'||k==='screening')){closeSheet();openPrep(appOf(id).jobId)}else openApp(id,(k==='interview'||k==='screening')?'prep':'details');toast(`השלב עודכן: ${STATUSES[k]}`)}

/* ═════════ LinkedIn ═════════ */
function renderLinkedIn(){
  if(CLOUDM){renderLinkedInReal();return}
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
  const L=S.li,h=L.handled[p.id],sel=Math.min(L.drafts[p.id]??0,p.drafts.length-1),txt=L['edit_'+p.id]??p.drafts[sel].t;
  const fresh=p.mins==null?'השבוע':p.mins<60?`לפני ${p.mins} דק׳`:`לפני ${Math.round(p.mins/60)} שעות`;
  return`<article class="post glass${h?' handled':''}" aria-label="פוסט של ${escB(p.author)}">
    <div class="post-top">${pav(p.author)}<div class="tx"><b>${escB(p.author)}</b><span>${escB(p.role)}</span></div><span class="fresh${p.mins<60?'':' old'}">${fresh}</span></div>
    <span class="why" style="align-self:flex-start;margin-top:-4px">${escB(p.why)}</span>
    <div class="post-text" lang="${p.lang}">${escB(p.text)}</div>
    ${h?`<div class="done-row"><span class="handled-tag">✓ הגבת לפוסט הזה</span><button class="mark" onclick="unhandle('${p.id}')">בטל</button></div>`:`
    <div class="drafts"><span class="drafts-h" id="dh-${p.id}">תגובה מוצעת · אפשר לערוך לפני שמעתיקים</span>
      <div class="tabs mini" role="radiogroup" aria-labelledby="dh-${p.id}">${p.drafts.map((d,i)=>`<button role="radio" aria-checked="${sel===i}" onclick="pickDraft('${p.id}',${i})">${escB(d.k)}</button>`).join('')}</div>
    </div>
    <label for="ed-${p.id}" class="vh">התגובה</label><textarea class="textbox${p.lang==='en'?' ltr':''}" id="ed-${p.id}" rows="5" oninput="S.li['edit_${p.id}']=this.value;save()">${esc(txt)}</textarea>
    <div class="duo"><button class="btn btn-ghost" onclick="copyText($('ed-${p.id}').value,'התגובה הועתקה')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${escB(p.url||LI_URL+'feed/')}" target="_blank" rel="noopener" onclick="copyText($('ed-${p.id}').value,'התגובה הועתקה. הדבק אותה מתחת לפוסט')">פתח את הפוסט${ICO.open}</a></div>
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
function copyFix(id){copyText((CLOUDM?(LI.fixes||[]):LI_FIXES).find(f=>f.id===id).copy,'הטקסט הועתק. הדבק אותו בפרופיל')}
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
  const U=CLOUDM?realUpdates():UPDATES;
  if(CLOUDM&&!U.length){el.innerHTML=`<p class="card-sub" style="padding:10px 4px">כאן יופיע מה שהסוכנים עשו בפועל: חיפושים, מכתבים, סקירות. הסריקה הבאה: 07:00 או 15:00.</p>`;return}
  const list=omAll?U:U.slice(0,5);
  el.innerHTML=list.map((u,i)=>{const a=CAREER.agents[u.a];return`<button class="om-item" onclick="${u.usage?'openUsage()':u.report?'openMeeting()':`openAgSheet(${u.a})`}"><span class="om-face"><canvas id="om-${i}" width="96" height="96"></canvas></span><span class="om-tx"><b>${a.name}</b><i>${u.time}</i><p>${escB(u.body)}</p></span></button>`}).join('')
    +(U.length>5?`<button class="om-more" onclick="omAll=!omAll;renderOfficeMsgs()">${omAll?'הצג פחות':`הצג עוד ${U.length-5}`}</button>`:'');
  list.forEach((u,i)=>face($('om-'+i),u.a));
}

/* גיל: סקירת חברה עם מקורות. כל עובדה עם מספר המקור שלה */
function briefHtml(j){
  const b=j.brief;
  if(!b)return`<div class="s-sec"><h4>על החברה</h4><p class="card-sub">${escB(N('researcher'))} מכין סקירה על ${escB(j.co)} עם מקורות. היא תופיע כאן תוך שעתיים בערך.</p></div>`;
  if(!b.found)return`<div class="s-sec"><h4>על החברה</h4><p class="card-sub">${escB(N('researcher'))} לא מצא מידע ציבורי אמין על ${escB(j.co)}, אז לא נכתב כלום. לפעמים זו חברת השמה שמסתירה את שם הלקוח.</p></div>`;
  const sup=i=>i==null?'':`<a class="src-n" href="${escB(b.sources[i].url)}" target="_blank" rel="noopener" aria-label="מקור ${i+1}">${i+1}</a>`;
  return`<div class="s-sec"><h4>על החברה</h4>
    ${b.what?`<p style="font-size:14px;line-height:1.6;margin-bottom:8px">${escB(b.what)} ${sup(b.what_src)}</p>`:''}
    ${b.facts.map(f=>`<div class="jc-r" style="margin-bottom:6px"><span class="ic" aria-hidden="true">•</span><span>${escB(f.text)} ${sup(f.src)}</span></div>`).join('')}
    ${b.why_you&&b.why_you.length?`<h4 style="margin-top:12px">איך זה מתחבר אליך</h4>${b.why_you.map(w=>`<div class="jc-r" style="margin-bottom:6px"><span class="ic ok" aria-hidden="true">✓</span><span>${escB(w)}</span></div>`).join('')}`:''}
    <div class="src-list">${b.sources.map((s,i)=>`<a href="${escB(s.url)}" target="_blank" rel="noopener"><span class="src-n">${i+1}</span><span dir="auto">${escB(s.title)}</span><small>${escB(s.domain)}</small></a>`).join('')}</div></div>`;
}
/* הכניסה להכנה לראיון, מתחת לסקירת החברה: מה מחכה בפנים */
function prepEntry(a,j){const p=j.prep||{},sk=(typeof lastSkills==='function'&&lastSkills())?lastSkills().stats.skills.cards||[]:[];
  const parts=[(p.questions||[]).length?`${p.questions.length} שאלות צפויות`:'',(p.tasks||[]).length?`${p.tasks.length} מטלות בית לתרגול`:'',
    sk.length?`${sk.length} כרטיסי כישורים`:'',j.brief&&j.brief.found?'סקירת החברה':''].filter(Boolean);
  return`<div class="s-sec"><button class="btn btn-ghost btn-block" onclick="openPrep('${a.jobId}')">${ICO.spark||''}הכנה לראיון</button>
    <p class="card-sub" style="margin-top:6px;text-align:center">${parts.length?'בפנים: '+escB(parts.join(', ')):`${escB(N('coach'))} מכינה שאלות, מטלות וכרטיסי כישורים למשרה הזו`}</p></div>`}
/* קובי: התאמת קורות החיים למשרה. רק ניסוח וסדר של מה שכבר כתוב אצלך. אתה מעתיק ומעדכן בעצמך */
function tailorHtml(j){
  const t=j.tailor,h=`<h4>קורות חיים למשרה הזו</h4>`;
  if(!t)return`<div class="s-sec">${h}<p class="card-sub">${escB(N('linkedin'))} יציע איך להדגיש בקורות החיים את מה שהמשרה מבקשת. ההצעות יופיעו כאן אחרי הריצה הקרובה.</p></div>`;
  if(t.no_ad)return`<div class="s-sec">${h}<p class="card-sub">אין מודעה מלאה למשרה הזו, אז ${escB(N('linkedin'))} לא הציע שינויים.</p></div>`;
  if(!t.edits.length)return`<div class="s-sec">${h}<p class="card-sub">${escB(N('linkedin'))} בדק: קורות החיים כבר מדגישים את מה שהמשרה מבקשת.${t.order?' '+escB(t.order):''}</p></div>`;
  return`<div class="s-sec">${h}<p class="card-sub" style="margin-bottom:8px">רק ניסוח וסדר של מה שכבר כתוב אצלך, בלי שום פרט חדש. מעתיקים את מה שמתאים ומעדכנים בקובץ שלך.</p>
    ${t.order?`<div class="jc-r" style="margin-bottom:10px"><span class="ic" aria-hidden="true">↑</span><span>${escB(t.order)}</span></div>`:''}
    ${t.edits.map((e,i)=>`<div class="tailor-ed"><div class="tl-b" dir="auto"><small>היום</small>${escB(e.before)}</div><div class="tl-a" dir="auto"><small>מוצע</small><span id="tl${i}">${escB(e.after)}</span></div>
      ${e.why?`<div class="card-sub" style="margin:4px 0 6px">${escB(e.why)}</div>`:''}
      <button class="btn btn-ghost btn-sm" onclick="copyText($('tl${i}').textContent,'השורה הועתקה')">${ICO.copy}העתק</button></div>`).join('')}</div>`;
}
/* קשרים: חיפושים מוכנים ב-LinkedIn. החיפוש וההודעה נעשים בחשבון שלך, על ידך */
const SCHOOLS=['HIT','Technion','Tel Aviv University','Hebrew University','Bar-Ilan','Ben-Gurion','Reichman','Ariel University','Afeka','Open University','University of Haifa','Shenkar','Ruppin','Sapir','Azrieli','Jerusalem College of Technology'];
function refHtml(j,id){
  const cv=prof().cv||'',school=SCHOOLS.find(s=>cv.toLowerCase().includes(s.toLowerCase()));
  const role=(j.title.match(/frontend|backend|full.?stack|data|machine learning|ml|ai|qa|devops|mobile|software/i)||['software'])[0];
  const rows=[school&&{t:`בוגרי ${school} ב-${j.co}`,s:'קשר משותף מקל לפתוח שיחה',q:`${j.co} ${school}`},
    {t:`מפתחים ב-${j.co}`,s:`אנשי ${role} מהצוות שתעבוד איתו`,q:`${j.co} ${role}`},
    {t:`גיוס ב-${j.co}`,s:'מגייסים ורכזי גיוס',q:`${j.co} recruiter`}].filter(Boolean);
  const note=`היי, ראיתי שאתה ב-${j.co}. אני ${prof().first||''}${school?`, סטודנט ב-${school}`:''}, ומתעניין במשרת ה-${nb(j.title)}. אשמח לשמוע ממך כמה מילים על הצוות, ואם זה מתאים, גם להמלצה. תודה!`;
  return`<p style="font-size:13.5px;color:var(--ink2);margin:12px 0 8px">המלצה מבפנים מקפיצה מועמדות. אלה חיפושים מוכנים ב-LinkedIn. אתה פותח, בוחר עם מי לדבר ושולח בעצמך.</p>
    ${rows.map(r=>`<a class="person ext" href="${liSearch(r.q)}" target="_blank" rel="noopener">${pav(r.t)}<div class="tx"><b dir="auto">${escB(r.t)}</b><span>${escB(r.s)}</span></div>${ICO.open}</a>`).join('')}
    <div class="s-sec"><h4>הודעה לדוגמה</h4><label for="refNote" class="vh">הודעה</label><textarea class="textbox" id="refNote" rows="5">${esc(note)}</textarea>
    <button class="btn btn-ghost btn-block" onclick="copyText($('refNote').value,'ההודעה הועתקה')">${ICO.copy}העתק</button></div>`;
}

/* LinkedIn אמיתי: פוסטים מהשבוע (קובי), שיפורי פרופיל מה-PDF שלך (מאיה), טיוטת פוסט שבועית */
function renderLinkedInReal(){
  const L=S.li,c=Math.min(L.comments,WEEK_GOAL.comments),posts=LI.posts||[],fixes=LI.fixes||[],draft=LI.draft||'';
  const fixed=fixes.filter(f=>L.fixes[f.id]).length;
  $('liScroll').innerHTML=`
    <section class="li-head glass" aria-labelledby="goalH">
      <span class="ring" style="--p:${Math.round(c/WEEK_GOAL.comments*100)}" aria-hidden="true"><b class="num">${c}/${WEEK_GOAL.comments}<small>תגובות</small></b></span>
      <span class="tx"><b id="goalH">היעד שלך השבוע</b><span>${c>=WEEK_GOAL.comments?'השגת את יעד התגובות. כל הכבוד':'5 תגובות טובות ופוסט אחד. אתה מגיב ומפרסם בעצמך, אנחנו מכינים'}</span>
        <span class="li-goal-line">פוסט השבוע: ${L.posts?'<b>פורסם ✓</b>':'עוד לא'}</span></span>
    </section>
    <div class="sec-h"><h2>פוסטים ששווה להגיב עליהם</h2><span>מהשבוע האחרון</span></div>
    ${posts.length?posts.map(p=>postCard(Object.assign({role:'',mins:null},p))).join(''):`<section class="card-solid"><p class="card-sub" style="padding:6px 2px">${escB(N('linkedin'))} מחפש פעמיים ביום פוסטים ציבוריים מהשבוע על גיוס ג׳וניורים וקריירה בהייטק. ${LI.updated?'בסריקה האחרונה לא נמצאו פוסטים שמתאימים לך.':'הם יופיעו כאן אחרי הסריקה הבאה.'}</p></section>`}
    <div class="sec-h" id="liFixes"><h2>הפרופיל שלך</h2><span>${fixes.length?`${fixed} מתוך ${fixes.length} בוצעו`:''}</span></div>
    ${fixes.length?`<section class="card-solid" aria-label="שיפורים לפרופיל">${fixes.map(fixRow).join('')}</section>`
      :`<section class="card-solid"><p class="card-sub" style="padding:6px 2px">${prof().li_text?`${escB(N('linkedin'))} עובר על הפרופיל שהעלית. השיפורים יופיעו כאן תוך שעתיים בערך.`:`כדי לקבל שיפורים לפרופיל, מעלים אותו בעמוד הפרופיל.`}</p>
        ${prof().li_text?'':`<button class="btn btn-sm btn-primary btn-block" onclick="goPage('profile')">לעמוד הפרופיל</button>`}</section>`}
    <div class="sec-h"><h2>הפוסט של השבוע</h2><span>${L.posts?'פורסם ✓':'טיוטה'}</span></div>
    <section class="card-solid">${draft||L.postText?`<label for="postDraft" class="vh">טיוטת פוסט</label><textarea class="textbox" id="postDraft" rows="10" oninput="S.li.postText=this.value;save()">${esc(L.postText||draft)}</textarea>
      <div class="hint-line ok">✓ מבוסס רק על מה שכתוב בקורות החיים שלך</div>
      <div class="duo"><button class="btn btn-ghost" onclick="copyText($('postDraft').value,'הפוסט הועתק')">${ICO.copy}העתק</button><a class="btn btn-primary ext" href="${LI_URL}feed/" target="_blank" rel="noopener" onclick="copyText($('postDraft').value,'הפוסט הועתק. הדבק אותו בפוסט חדש')">פתח את LinkedIn${ICO.open}</a></div>
      <div class="done-row" style="margin-top:10px"><span>פרסמת?</span><button class="mark" onclick="S.li.posts=S.li.posts?0:1;save();renderLinkedIn();syncChrome()">${L.posts?'בטל סימון':'פרסמתי ✓'}</button></div>`
      :`<p class="card-sub" style="padding:6px 2px">${escB(N('linkedin'))} יכין טיוטה על אחד הפרויקטים שלך בסריקה הבאה.</p>`}</section>`;
}

/* ═════════ הכנה לראיון: מסך אחד עם כל מה שצריך, לכל משרה ששמרת ═════════ */
let prepJob=null;
function openPrep(jobId){prepJob=jobId;goPage('prep')}
function prepApps(){const order={interview:0,screening:1,applied:2,saved:3};
  return S.apps.filter(a=>JOBS[a.jobId]&&order[a.status]!=null).sort((x,y)=>order[x.status]-order[y.status])}
function renderPrep(){
  const apps=prepApps();
  if(!apps.length){$('prepScroll').innerHTML=`<div class="empty" style="padding:48px 12px"><h3>עוד אין משרה להתכונן אליה</h3><p>שמור משרה, ו${escB(N('coach'))} תכין שאלות לפי מה שכתוב במודעה. ${escB(N('researcher'))} יכין סקירה על החברה.</p><button class="btn btn-primary" onclick="goPage('jobs')">למשרות</button></div>`+storiesHtml()+(typeof skillsHtml==='function'?skillsHtml():'');return}
  if(!apps.some(a=>a.jobId===prepJob))prepJob=apps[0].jobId;
  const a=apps.find(x=>x.jobId===prepJob),j=JOBS[prepJob],qs=(j.prep&&j.prep.questions)||[],b=j.brief;
  a.answers=a.answers||{};
  $('prepScroll').innerHTML=`
    <div class="prep-jobs" role="tablist" aria-label="בחירת משרה">${apps.map(x=>`<button role="tab" aria-selected="${x.jobId===prepJob}" onclick="prepJob='${x.jobId}';renderPrep()"><b dir="auto">${escB(JOBS[x.jobId].co)}</b><span>${STATUSES[x.status]}${x.iv?' · '+escB(x.iv):''}</span></button>`).join('')}</div>

    <section class="card glass prep-head">${logo(j)}<div style="min-width:0;flex:1"><h2 class="card-h" dir="auto" style="margin:0">${escB(j.title)}</h2><div class="card-sub" style="margin:2px 0 0">${escB(j.co)} · ${STATUSES[a.status]}${a.iv?' · '+escB(a.iv):''}</div></div>
      <button class="btn btn-sm btn-ghost" onclick="openApp('${a.id}','details')">המשרה</button></section>

    <section class="card glass" aria-labelledby="pqH"><h2 class="card-h" id="pqH">שאלות שכדאי להתכונן אליהן</h2>
      ${!j.prep?`<p class="card-sub">${escB(N('coach'))} מכינה שאלות לפי הדרישות במודעה. הן יופיעו כאן תוך שעתיים בערך.</p>`
        :!qs.length?`<p class="card-sub">במודעה לא היו מספיק פרטים לשאלות ממוקדות. אפשר לתרגל שאלות כלליות בצ׳אט.</p>`
        :`<div class="card-sub">לפי מה שכתוב במודעה. לחץ על שאלה, קרא את הרמז, וכתוב תשובה משלך. היא נשמרת.</div>
        ${qs.map((q,i)=>`<details class="q"${i===0?' open':''}><summary><span class="qtag" dir="auto">${escB(q.tag)}</span><span class="qtxt">${escB(q.q)}</span>${a.answers[i]?'<span class="q-done" aria-label="ענית">✓</span>':''}</summary>
          <div class="hint">${escB(q.h)}</div>
          <label class="vh" for="ans${i}">התשובה שלי</label><textarea class="textbox" id="ans${i}" rows="4" placeholder="התשובה שלי…" onchange="prepAnswer(${i},this.value)">${esc(a.answers[i]||'')}</textarea></details>`).join('')}`}
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="toggleChat(true);chatAsk('בוא נתרגל ראיון ל-${escB(j.title).replace(/'/g,'')} ב-${escB(j.co).replace(/'/g,'')}. תשאל שאלה אחת בכל פעם.')">לתרגל בצ׳אט</button></section>

    <section class="card glass" aria-labelledby="pcH"><h2 class="card-h" id="pcH">מה לדעת על ${escB(j.co)}</h2>
      ${!b?`<p class="card-sub">${escB(N('researcher'))} מכין סקירה עם מקורות. היא תופיע כאן תוך שעתיים בערך.</p>`
        :!b.found?`<p class="card-sub">לא נמצא מידע ציבורי אמין על החברה. כדאי לשאול בשיחה על המוצר והצוות.</p>`
        :`${b.what?`<p style="font-size:14px;line-height:1.6;margin-bottom:6px">${escB(b.what)}</p>`:''}${b.facts.slice(0,3).map(f=>`<div class="jc-r" style="margin-bottom:6px"><span class="ic" aria-hidden="true">•</span><span>${escB(f.text)}</span></div>`).join('')}
          <button class="link" style="color:var(--brand);font-weight:600;margin-top:4px" onclick="openApp('${a.id}','details')">לסקירה המלאה עם המקורות</button>`}</section>

    ${tasksHtml(a,j)}

    ${storiesHtml()}
    ${typeof skillsHtml==='function'?skillsHtml():''}`;
}
/* מטלות בית לדוגמה: 2 מוצגות, "מטלה אחרת" מחליפה מהמאגר */
function tasksHtml(a,j){
  const pool=(j.prep&&j.prep.tasks)||null;
  const head=`<section class="card glass" aria-labelledby="ptH"><h2 class="card-h" id="ptH">מטלות בית לדוגמה</h2>`;
  if(!pool)return head+`<p class="card-sub">${escB(N('coach'))} מחפשת מטלות בית אמיתיות למשרה כזו, עם מקור ופתרון. הן יופיעו כאן תוך שעתיים בערך.</p></section>`;
  if(!pool.length)return head+`<p class="card-sub">לא נמצאו מטלות ציבוריות שמתאימות לתפקיד הזה.</p>${j.prep.no_more_tasks?'':`<button class="btn btn-sm btn-ghost btn-block" onclick="requestMoreTasks('${a.jobId}')">לחפש שוב</button>`}</section>`;
  a.tasks=(a.tasks||[0,1]).filter(i=>i<pool.length);a.usedTasks=a.usedTasks||[];
  for(let i=0;a.tasks.length<Math.min(2,pool.length)&&i<pool.length;i++)if(!a.tasks.includes(i)&&!a.usedTasks.includes(i))a.tasks.push(i);
  return head+`<div class="card-sub">מטלות שחברות נותנות למועמדים לתפקידים כאלה, ממאגרים ציבוריים. לכל אחת מקור, ופתרון מוצע של ${escB(N('coach'))}.</div>
    ${a.tasks.map((ti,slot)=>{const t=pool[ti];
      const who=t.same_company?`<span class="task-src ok">מטלה של ${escB(t.company)} ✓</span>`:t.company?`<span class="task-src">מטלה של ${escB(t.company)}</span>`:`<span class="task-src">מקור ציבורי, לא מהחברה</span>`;
      return`<article class="task"><div class="task-top"><b>${escB(t.title)}</b>${who}</div>
        <p>${escB(t.summary)}</p>
        ${t.req&&t.req.length?`<ul>${t.req.map(r=>`<li><span dir="auto">${escB(r)}</span></li>`).join('')}</ul>`:''}
        ${t.time?`<div class="card-sub">זמן: ${escB(t.time)}</div>`:''}
        <details><summary>פתרון מוצע של ${escB(N('coach'))}</summary><ol>${t.solution.map(x=>`<li><span dir="auto">${escB(x)}</span></li>`).join('')}</ol>${t.why?`<p class="card-sub">${escB(t.why)}</p>`:''}</details>
        <div class="duo"><a class="btn btn-sm btn-ghost ext" href="${escB(t.url)}" target="_blank" rel="noopener"><span dir="ltr">${escB(t.repo)}</span>${ICO.open}</a><button class="btn btn-sm btn-ghost" onclick="swapTask('${a.jobId}',${slot})">מטלה אחרת</button></div></article>`}).join('')}</section>`;
}
function swapTask(jobId,slot){
  const a=S.apps.find(x=>x.jobId===jobId),pool=JOBS[jobId].prep.tasks;
  a.usedTasks=a.usedTasks||[];a.usedTasks.push(a.tasks[slot]);
  const next=pool.findIndex((t,i)=>!a.tasks.includes(i)&&!a.usedTasks.includes(i));
  if(next<0){if(JOBS[jobId].prep.no_more_tasks){toast('אין כרגע מטלות נוספות לתפקיד הזה');a.usedTasks.pop();return}
    save();requestMoreTasks(jobId);return}
  a.tasks[slot]=next;save();renderPrep();toast('הוחלפה מטלה');
}
function prepAnswer(i,v){const a=S.apps.find(x=>x.jobId===prepJob);if(!a)return;a.answers=a.answers||{};if(v.trim())a.answers[i]=v;else delete a.answers[i];save()}
function storiesHtml(){
  return`<section class="card glass" aria-labelledby="pstH"><h2 class="card-h" id="pstH">בנק הסיפורים שלך</h2>
    <div class="card-sub">סיפורים אמיתיים שלך בשיטת STAR: מצב, משימה, פעולה, תוצאה. מכינים פעם אחת ומשתמשים בכל ראיון.</div>
    ${S.stories.length?S.stories.map(st=>`<button class="row" onclick="editStory('${st.id}')"><span class="ri">${ROW_IC.book}</span><span class="rl"><b>${escB(st.t)}</b><span>${/תוצאה: *$/.test(st.b)?'חסרה התוצאה':'מוכן'}</span></span><span class="chev" aria-hidden="true"></span></button>`).join('')
      :`<p class="card-sub">עוד אין סיפורים. כדאי להתחיל מפרויקט אחד מקורות החיים: מה הייתה הבעיה, מה עשית, ומה יצא.</p>`}
    <button class="btn btn-sm btn-ghost btn-block" style="margin-top:8px" onclick="editStory()">להוסיף סיפור</button></section>`;
}

function saveNote(id){const a=appOf(id),t=$('edNote');if(!a||!t)return;a.note=t.value.trim();save();refreshApps();
  $('edNoteBtn').disabled=true;toast(a.note?'ההערה נשמרה':'ההערה נמחקה')}
/* ═════════ הסרה בהחלקה + היסטוריה ═════════ */
let lastRemoved=null;
/* האם המשרה עדיין פתוחה: מה שדורון בדק בבוקר */
function openTxt(j){const c=j.check;if(!c)return`${escB(N('hunter'))} יבדוק מחר בבוקר`;
  const d=agoTxt(daysSince(c.at));
  return c.st==='open'?`כן, נבדק ${escB(d)}`:c.st==='unknown'?`לא הצלחתי לבדוק (האתר לא ענה${c.n>1?` ${c.n} פעמים`:''}). כדאי לפתוח ולבדוק`:'נסגרה'}
async function markClosed(id){track('job_closed_btn');const a=appOf(id);if(!a)return;const j=JOBS[a.jobId],now=new Date().toISOString();
  j.closed_at=now;closedToHistory();save();closeSheet();refreshApps();closeInCloud(a.jobId,now)}
async function closeInCloud(jobId,now){   // דורון לא בודק אותה שוב, והסוכנים מפסיקים לעבוד עליה
  if(CLOUDM&&ME){try{const {data}=await SB.from('jobs').select('card').eq('user_id',ME.id).eq('id',jobId).maybeSingle();
    if(data)await SB.from('jobs').update({card:Object.assign({},data.card,{closed_at:now,closed_by:'user'})}).eq('user_id',ME.id).eq('id',jobId)}catch(e){console.warn(e)}}}
function removeApp(id){
  const a=appOf(id);if(!a)return;const j=JOBS[a.jobId];
  S.apps=S.apps.filter(x=>x.id!==id);S.history=S.history||[];
  S.history.unshift({jobId:a.jobId,co:j.co,title:j.title,url:j.url,reason:'removed',date:new Date().toISOString(),app:a});
  if(S.decisions[a.jobId]==='save')S.decisions[a.jobId]='removed';  // הסוכנים מפסיקים לעבוד עליה
  lastRemoved=a.jobId;save();refreshApps();
  /* למה הוסרה: דורון לומד מזה כמו מדילוג (agent_core/taste.py). "נסגרה" = לא סיבה של טעם */
  const h=S.history[0];
  toast(`הוסרה מההגשות. למה?`,{undo:()=>restoreApp(lastRemoved),ms:9000,chips:[{t:'נסגרה',fn:()=>{
      track('remove_reason',{r:'נסגרה'});h.why='נסגרה';h.reason='closed';j.closed_at=j.closed_at||new Date().toISOString();save();refreshApps();closeInCloud(a.jobId,j.closed_at);toast('עודכן: המשרה נסגרה')}},
    ...whyChips(a.jobId,j,'apps',t=>{h.why=(S.skip[a.jobId]||{}).x||t;S.decisions[a.jobId]='skip';save();refreshApps();toast(`תודה, ${N('hunter')} ילמד מזה`)})]});
}
function restoreApp(jobId){
  const h=(S.history||[]).find(x=>x.jobId===jobId);if(!h)return;
  if(h.reason==='closed'){toast('המשרה נסגרה, אי אפשר להחזיר אותה להגשות');return}
  S.history=S.history.filter(x=>x!==h);
  S.apps.unshift(h.app||{id:'a-'+jobId,jobId,status:'saved',date:new Date().toISOString(),letter:''});
  S.decisions[jobId]='save';delete S.skipReasons[jobId];if(S.skip)delete S.skip[jobId];save();refreshApps();toast('המשרה חזרה להגשות');
}
function historyHtml(onlyIfAny){
  const H=(S.history||[]).filter(h=>JOBS[h.jobId]||h.title);
  if(!H.length)return'';
  const why={closed:'נסגרה למועמדים',removed:'הסרת'};
  return`<details class="history"${onlyIfAny?' open':''}><summary>היסטוריה <b class="num">${H.length}</b></summary>
    ${H.map(h=>`<div class="hist-row"><span class="tx"><b dir="auto">${escB(h.title)}</b><span>${escB(h.co)} · ${why[h.reason]||''}${h.why&&h.why!=='נסגרה'?`: ${escB(h.why)}`:''} · ${new Date(h.date).toLocaleDateString('he-IL')}</span></span>
      ${h.reason==='removed'?`<button class="btn btn-sm btn-ghost" onclick="restoreApp('${h.jobId}')">להחזיר</button>`:h.url?`<a class="btn btn-sm btn-ghost ext" href="${escB(h.url)}" target="_blank" rel="noopener">למודעה${ICO.open}</a>`:''}</div>`).join('')}
  </details>`;
}
function bindAppSwipes(){
  document.querySelectorAll('#appsList .swipe').forEach(w=>{
    const card=w.querySelector('.app');let x0=null,y0=0,dx=0,drag=false;
    card.addEventListener('pointerdown',e=>{if(e.target.closest('textarea,input'))return;x0=e.clientX;y0=e.clientY;dx=0;drag=false});
    card.addEventListener('pointermove',e=>{if(x0===null)return;const mx=e.clientX-x0,my=e.clientY-y0;
      if(!drag&&Math.abs(mx)>12&&Math.abs(mx)>Math.abs(my)*1.4){drag=true;card.setPointerCapture(e.pointerId);w.classList.add('dragging')}
      if(drag){dx=mx;card.style.transform=`translateX(${dx}px)`;w.classList.toggle('arm',Math.abs(dx)>w.offsetWidth*.35)}});
    const end=()=>{if(x0===null)return;x0=null;w.classList.remove('dragging');
      if(drag&&Math.abs(dx)>w.offsetWidth*.35){card.style.transition='transform .2s ease';card.style.transform=`translateX(${dx>0?'110%':'-110%'})`;setTimeout(()=>removeApp(w.dataset.id),180)}
      else{card.style.transition='transform .2s ease';card.style.transform='';setTimeout(()=>card.style.transition='',220)}
      if(drag){card.addEventListener('click',ev=>{ev.stopPropagation();ev.preventDefault()},{capture:true,once:true})}drag=false;w.classList.remove('arm')};
    card.addEventListener('pointerup',end);card.addEventListener('pointercancel',end);
  });
}

/* ═════════ ערכת הגשה: מה שצריך כדי למלא טופס, במקום אחד ═════════
   הפרטים הקבועים נשמרים בפרופיל (ans.kit). כפתור המילוי ממלא שדות לפי התוויות שלהם, מסמן בצהוב מה שלא בטוח,
   ולעולם לא לוחץ "שלח". את ההגשה עושה המשתמש. */
const KIT_FIELDS=[
  ['full','שם מלא',p=>p.name||''],['first','שם פרטי',p=>p.first||(p.name||'').split(' ')[0]||''],['last','שם משפחה',p=>(p.name||'').split(' ').slice(1).join(' ')],
  ['email','מייל',p=>kitOf(p).email||((typeof ME!=='undefined'&&ME&&ME.email)||'')],['phone','טלפון',p=>kitOf(p).phone||''],
  ['city','עיר',p=>kitOf(p).city||''],['linkedin','LinkedIn',p=>(p.ans||{}).linkedin||''],
  ['github','GitHub',p=>{const g=((p.ans||{}).github||'').trim();return g?(g.startsWith('http')?g:'https://github.com/'+g.replace(/^@/,'')):''}],
  ['site','אתר / תיק עבודות',p=>kitOf(p).site||''],['edu','השכלה',p=>kitOf(p).edu||''],
  ['salary','ציפיות שכר',p=>(p.ans||{}).salaryH||(p.ans||{}).salary||''],['auth','אישור עבודה בישראל',p=>kitOf(p).auth||''],
  ['start','זמינות',p=>(p.ans||{}).start||''],
];
function kitOf(p){return (p.ans||{}).kit||{}}
function kitData(){const p=prof(),o={};KIT_FIELDS.forEach(([k,,f])=>{const v=f(p);if(v&&!/עוד לא|לא בטוח/.test(v))o[k]=v});return o}

function kitTabHtml(a,j,id){track('kit_open');
  const p=prof(),d=kitData(),missing=KIT_FIELDS.filter(([k])=>!d[k]&&!['first','last'].includes(k));
  const letter=a.letter||(j.letter&&j.letter.text)||(REAL?'':letterFor(j)),tl=j.tailor&&j.tailor.edits&&j.tailor.edits.length;
  return `<div class="s-sec" style="margin-top:12px"><h4>קורות חיים</h4>
      <p class="card-sub">${escB(p.cvName||'קורות החיים מהפרופיל')}${tl?`. ${escB(N('linkedin'))} הציע ${j.tailor.edits.length} התאמות למשרה הזו <button class="link" style="color:var(--brand);font-weight:600" onclick="appTab='details';paintAppTab('${id}')">בלשונית פרטים</button>`:''}</p></div>
    <div class="s-sec"><h4>מכתב פנייה</h4><label for="letterBox" class="vh">מכתב פנייה</label><textarea class="textbox letterbox${/[\u0590-\u05FF]/.test(letter.slice(0,300))?'':' ltr'}" id="letterBox" rows="16" spellcheck="false" oninput="appOf('${id}').letter=this.value;save()">${esc(letter)}</textarea>
      ${REAL&&!a.letter&&!j.letter?`<div class="hint-line">${N('assistant')} מכין את המכתב. הוא יופיע כאן תוך שעתיים בערך.</div>`:j.letter&&!j.letter.checked?`<div class="hint-line">חלק מהמשפטים הוסרו כי לא נמצאו בקורות החיים. כדאי לקרוא לפני ששולחים.</div>`:`<div class="hint-line ok">✓ כל שם, טכנולוגיה ומספר במכתב נבדקו מול קורות החיים והמודעה</div>`}
      <button class="btn btn-ghost btn-sm" onclick="copyText($('letterBox').value,'המכתב הועתק');track('letter_copy')">${ICO.copy}להעתיק את המכתב</button></div>
    <div class="s-sec"><h4>הפרטים שלך לטופס</h4>
      <p class="card-sub">${KIT_FIELDS.filter(([k])=>!['first','last'].includes(k)).length-missing.length} מתוך ${KIT_FIELDS.filter(([k])=>!['first','last'].includes(k)).length} מולאו${missing.length?`. חסר: ${escB(missing.map(m=>m[1]).join(', '))}`:''}. <button class="link" style="color:var(--brand);font-weight:600" onclick="closeSheet();openKitEdit()">${missing.length?'להשלים':'לערוך'}</button></p></div>
    <div class="s-sec"><h4>מילוי הטופס</h4>
      <ol class="how-ol"><li>להעתיק את המכתב (למעלה)</li><li>לפתוח את המשרה ולהגיע לטופס</li><li>ללחוץ על הסימנייה "findjob · מילוי". היא ממלאת את מה שהיא מזהה ומסמנת בצהוב מה לבדוק. היא לא שולחת לעולם</li></ol>
      <div class="duo"><button class="btn btn-ghost" onclick="openFillHelp()">איך מוסיפים את הסימנייה</button><a class="btn btn-primary ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener" onclick="copyText($('letterBox').value,'המכתב הועתק. הדבק אותו בטופס')">לפתוח את המשרה${ICO.open}</a></div>
      <p class="card-sub" style="margin-top:8px">${CLOUDM?`שאלה בטופס? <button class="link" style="color:var(--brand);font-weight:600" onclick="askAboutJob('${a.jobId}');$('chatInput').value+='בטופס ההגשה שואלים: '">${escB(N('assistant'))} זמין בצ׳אט</button>`:''}</p></div>
    <div class="s-sec">${appliedBox(a,true)}</div>`;
}

function openKitEdit(){const k=kitOf(prof()),f=(id,l,v,ph,t)=>`<div class="field"><label for="${id}">${l}</label><input id="${id}" ${t?`type="${t}" class="ltr"`:''} value="${escB(v||'')}" placeholder="${ph}"></div>`;
  openSheet(`<h3 id="sheetTitle">פרטים לטפסי הגשה</h3><div class="sheet-sub">נשמרים רק אצלך, ומשמשים למילוי טפסים. שום דבר לא נשלח בלי שתלחץ בעצמך.</div>
    ${f('kEmail','מייל',k.email||((typeof ME!=='undefined'&&ME&&ME.email)||''),'name@gmail.com','email')}${f('kPhone','טלפון',k.phone,'050-0000000','tel')}
    ${f('kCity','עיר מגורים',k.city,'למשל: תל אביב')}${f('kSite','אתר או תיק עבודות',k.site,'https://','url')}
    ${f('kEdu','השכלה',k.edu,'למשל: B.Sc. Computer Science, HIT, 2026')}
    <div class="field"><label for="kAuth">אישור עבודה בישראל</label><select id="kAuth">${['','אזרח/ית ישראלי/ת','תושב/ת קבע','אשרת עבודה'].map(o=>`<option${o===(k.auth||'')?' selected':''}>${o}</option>`).join('')}</select></div>
    <p class="card-sub">שכר וזמינות נלקחים מהשאלון.</p>
    <button class="btn btn-primary btn-block" onclick="saveKit()">שמירה</button>`)}
function saveKit(){track('profile_kit');const p=prof();p.ans=p.ans||{};p.ans.kit={email:$('kEmail').value.trim(),phone:$('kPhone').value.trim(),city:$('kCity').value.trim(),
  site:$('kSite').value.trim(),edu:$('kEdu').value.trim(),auth:$('kAuth').value};save();closeSheet();if(curPg==='profile')renderProfile();toast('הפרטים נשמרו')}

/* הסימנייה: קוד שרץ בדף הטופס. הפרטים הקבועים בתוכה. המכתב נלקח מהלוח (אחרי "להעתיק את המכתב") */
function fillBookmarklet(){
  const D=JSON.stringify(kitData());
  const src=`(async()=>{const D=${D};
const R={first:/first.?name|given.?name|שם פרטי/i,last:/last.?name|family.?name|surname|שם משפחה/i,full:/full.?name|^name$|your name|שם מלא|^שם$/i,
email:/e-?mail|מייל|דוא.?ל/i,phone:/phone|mobile|\\btel\\b|טלפון|נייד/i,linkedin:/linkedin/i,github:/github/i,site:/website|portfolio|personal site|אתר|תיק עבודות/i,
city:/city|location|address|current location|עיר|מגורים/i,salary:/salary|compensation|expected pay|שכר/i,start:/start date|notice|availability|available|זמינות|תחילת עבודה/i,
auth:/authori[sz]ed|work permit|visa|sponsorship|אישור עבודה/i,edu:/education|degree|school|university|השכלה|תואר|מוסד/i,letter:/cover.?letter|motivation|why .*(us|company)|מכתב|ספר.? על עצמך/i};
const tx=n=>(n.innerText||n.textContent||'').trim();const lab=e=>{let t=[];if(e.id){const l=document.querySelector('label[for="'+CSS.escape(e.id)+'"]');if(l)t.push(tx(l))}const pl=e.closest('label');if(pl)t.push(tx(pl));
t.push(e.getAttribute('aria-label')||'',e.placeholder||'',e.name||'',e.id||'');const w=e.closest('[class*=field],[class*=question],[data-automation-id]');if(w&&!t[0])t.push(tx(w).slice(0,80));return t.join(' | ')};
const set=(e,v)=>{const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};
const mark=(e,c)=>{e.style.outline='3px solid '+c;e.style.outlineOffset='2px'};
let clip='';try{clip=await navigator.clipboard.readText()}catch(x){}
let n=0,y=0;
for(const e of document.querySelectorAll('input,textarea,select')){if(e.disabled||e.type==='hidden'||e.type==='submit'||e.type==='button'||e.offsetParent===null)continue;
if(e.type==='file'){mark(e,'#E9A825');y++;continue}
if(e.tagName==='SELECT'||e.type==='checkbox'||e.type==='radio'){if(e.required||e.getAttribute('aria-required')==='true'){mark(e,'#E9A825');y++}continue}
if(e.value&&e.value.trim())continue;const L=lab(e);let k=Object.keys(R).find(k=>R[k].test(L));
if(k==='full'&&(R.first.test(L)||R.last.test(L)))k=R.first.test(L)?'first':'last';
let v=k==='letter'?(clip.length>200?clip:''):D[k];
if(k&&v){set(e,v);const sure=k!=='letter'&&k!=='city'&&k!=='salary'&&k!=='start';mark(e,sure?'#3E8A66':'#E9A825');n++;if(!sure)y++}
else if(e.required||e.getAttribute('aria-required')==='true'){mark(e,'#E9A825');y++}}
const b=document.createElement('div');b.dir='rtl';b.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;right:12px;max-width:420px;margin:auto;background:#2F4858;color:#fff;font:15px/1.5 system-ui,sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.3)';
b.textContent='findjob מילא '+n+' שדות. '+(y?y+' מסומנים בצהוב: כדאי לבדוק (קובץ קורות חיים, בחירות, מכתב). ':'')+'בדוק הכל ושלח בעצמך. findjob לא שולח.';b.onclick=()=>b.remove();document.body.appendChild(b);setTimeout(()=>b.remove(),12000)})()`;
  return 'javascript:'+encodeURIComponent(src)}
function openFillHelp(){track('fill_help');const href=fillBookmarklet();
  openSheet(`<h3 id="sheetTitle">הסימנייה "findjob · מילוי"</h3><div class="sheet-sub">מוסיפים פעם אחת. אחרי שמשנים פרטים בפרופיל, כדאי להוסיף מחדש.</div>
    <h4 class="sub-h">במחשב</h4><p class="card-sub">גוררים את הכפתור הזה לסרגל הסימניות:</p>
    <a class="btn btn-primary btn-block" href="${href}" onclick="event.preventDefault();toast('צריך לגרור אותו לסרגל הסימניות')">findjob · מילוי</a>
    <h4 class="sub-h">בטלפון</h4><ol class="how-ol"><li>להעתיק את הקוד בכפתור למטה</li><li>להוסיף לסימניות דף כלשהו, ולערוך את הסימנייה: שם "findjob מילוי", ובכתובת להדביק את הקוד</li>
      <li>אנדרואיד (Chrome): בדף הטופס מקלידים בשורת הכתובת "findjob מילוי" ובוחרים את הסימנייה. אייפון (Safari): פותחים את הסימניות ולוחצים עליה</li></ol>
    <button class="btn btn-ghost btn-block" onclick="copyText(${escB(JSON.stringify(href))},'הקוד הועתק')">${ICO.copy}להעתיק את הקוד</button>
    <p class="card-sub" style="margin-top:8px">הסימנייה עובדת עם Greenhouse, Lever, Comeet, Workday ורוב הטפסים הרגילים. יש אתרים שחוסמים סימניות כאלה, ושם ממלאים ידנית.</p>`)}
