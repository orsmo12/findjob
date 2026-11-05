/* ═════════ shell ═════════ */
const TITLES={main:'לוח בקרה',jobs:'משרות חדשות',apps:'הגשות',prep:'הכנה לראיון',linkedin:'LinkedIn',office:'המשרד',profile:'הפרופיל שלי',settings:'הגדרות'};
let curPg='main';
function goPage(id,anchor){
  track('page_'+id);
  if(typeof offAnimId!=='undefined') cancelAnimationFrame(offAnimId);
  closeDrawer();closeSheet();if(chatOpen)toggleChat();
  curPg=id;
  document.querySelectorAll('.pg').forEach(p=>p.classList.toggle('on',p.id==='pg-'+id));
  document.body.className=(document.body.className.replace(/\bpg-\w+/g,'').trim()+' pg-'+id).trim();
  $('tbTitle').innerHTML=id==='main'?'<span class="wordmark" aria-hidden="true">findjob</span><span class="vh">לוח בקרה</span>':escB(TITLES[id]);
  document.title=id==='main'?'findjob':`${TITLES[id]} · findjob`;
  document.querySelectorAll('.dr-item[data-pg]').forEach(b=>{const on=b.dataset.pg===id;b.classList.toggle('active',on);on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
  $('topbar').classList.remove('scrolled');
  const sc=document.querySelector('#pg-'+id+' .scroll'); if(sc) sc.scrollTop=0;
  ({main:renderHome,jobs:renderJobs,apps:renderApps,prep:renderPrep,linkedin:renderLinkedIn,profile:renderProfile,settings:renderSettings})[id]?.();
  if(id==='office'){setTimeout(()=>{sizeOff();drawOff();},80);renderOffice();renderOfficeMsgs();}
  if(anchor) setTimeout(()=>$(anchor)?.scrollIntoView({behavior:'smooth',block:'start'}),60);
  syncChrome();
}
function syncChrome(){
  const q=queue().length, ap=S.apps.filter(appNeedsMe).length, li=hotPosts().length+fixesLeft().length;
  [['bdJobs',q],['bdApps',ap],['bdLi',li]].forEach(([i,n])=>{$(i).hidden=!n;$(i).textContent=n;$(i).setAttribute('aria-label',`${n} מחכים לך`)});
  $('menuDot').hidden=!(q||hotPosts().length);
  const iv=S.apps.find(a=>a.status==='interview'&&a.iv);
  $('drIv').hidden=!iv; if(iv) $('drIvTxt').textContent=`ראיון ב-${JOBS[iv.jobId].co}, ${iv.iv}`;
  const ini=initials(prof().first||prof().name);
  ['tbAvatar','drAvatar'].forEach(i=>$(i).textContent=ini);
  $('drName').textContent=prof().name; $('drGoal').textContent=goalTxt();
}
function openIvShortcut(){const iv=S.apps.find(a=>a.status==='interview');if(iv)openPrep(iv.jobId)}
function toggleDrawer(){$('drawerOverlay').classList.contains('open')?closeDrawer():openDrawer()}
function openDrawer(){syncChrome();$('drawerOverlay').classList.add('open');document.body.classList.add('drawer-open');$('menuBtn').setAttribute('aria-expanded','true');$('menuBtn').setAttribute('aria-label','סגירת התפריט')}
function closeDrawer(){$('drawerOverlay').classList.remove('open');document.body.classList.remove('drawer-open');$('menuBtn').setAttribute('aria-expanded','false');$('menuBtn').setAttribute('aria-label','פתיחת התפריט')}
(function(){
  let sx=0,sy=0,mode=null;
  document.addEventListener('touchstart',e=>{
    const t=e.touches[0],appLeft=$('app').getBoundingClientRect().left;sx=t.clientX;sy=t.clientY;
    const open=$('drawerOverlay').classList.contains('open');
    mode=!open&&sx-appLeft<22&&curPg!=='jobs'?'open':open?'close':null;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!mode)return;const dx=e.touches[0].clientX-sx,dy=Math.abs(e.touches[0].clientY-sy);
    if(dy>40){mode=null;return}
    if(mode==='open'&&dx>36){openDrawer();mode=null}
    if(mode==='close'&&dx<-40){closeDrawer();mode=null}
  },{passive:true});
})();
document.addEventListener('scroll',e=>{if(e.target.classList&&e.target.classList.contains('scroll'))$('topbar').classList.toggle('scrolled',e.target.scrollTop>4)},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('sheet').classList.contains('open'))closeSheet();else if(chatOpen)toggleChat();else closeDrawer()}
  const typing=/INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if(curPg==='jobs'&&!$('sheet').classList.contains('open')&&!typing&&!$('onb').classList.contains('open')){
    if(e.key==='ArrowRight'){e.preventDefault();decide('save')} if(e.key==='ArrowLeft'){e.preventDefault();decide('skip')}
  }
});

let sheetReturn=null;
function openSheet(html){sheetReturn=document.activeElement;$('sheetBody').innerHTML=html;$('sheetBody').scrollTop=0;$('sheet').classList.add('open');setTimeout(()=>$('sheet').querySelector('.sheet-x')?.focus({preventScroll:true}),60)}
function closeSheet(){if(!$('sheet').classList.contains('open'))return;$('sheet').classList.remove('open');sheetReturn?.focus?.({preventScroll:true})}

function toast(msg,{undo,chips,ms=3600}={}){
  $('toasts').querySelectorAll('.toast').forEach(t=>t.remove());
  const el=document.createElement('div');el.className='toast';
  el.innerHTML=`<div class="toast-row"><span>${escB(msg)}</span>${undo?'<button class="undo">ביטול</button>':''}</div>${chips?`<div class="toast-chips">${chips.map((c,i)=>`<button data-i="${i}">${escB(c.t)}</button>`).join('')}</div>`:''}`;
  const kill=()=>{el.classList.add('out');setTimeout(()=>el.remove(),220)};
  if(undo) el.querySelector('.undo').onclick=()=>{undo();kill()};
  if(chips) el.querySelectorAll('.toast-chips button').forEach(b=>b.onclick=()=>{chips[b.dataset.i].fn();kill()});
  $('toasts').appendChild(el); setTimeout(kill,ms);
}
function face(cv,idx,state){if(cv) drawFace(cv,idx,state||CAREER.agents[idx].state)}
function logo(j){return`<span class="logo-tile" aria-hidden="true" style="background:linear-gradient(140deg,${j.c[0]},${j.c[1]})">${escB(j.ini)}</span>`}
const pav=n=>`<span class="pav" aria-hidden="true">${escB([...n.trim()][0]||'?')}</span>`;
const ICO={
  li:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 10v6M8 7.5v.01M12 16v-3.5a2 2 0 014 0V16M12 10v6"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  jobs:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  mail:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
  spark:'<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  open:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
};

/* ═════════ לוח בקרה ═════════ */
function nextSteps(){
  const out=[],hp=hotPosts(),q=queue();
  if(hp.length&&(CLOUDM||!REAL)) out.push({ic:ICO.li,c:'i-amber',b:hp.length===1?'פוסט ששווה להגיב עליו':`${hp.length} פוסטים ששווה להגיב עליהם`,s:CLOUDM?'תגובות מוכנות להעתקה':`הראשון פורסם לפני ${Math.min(...hp.map(p=>p.mins))} דק׳`,w:CLOUDM?null:['עכשיו','w-urgent'],go:"goPage('linkedin')"});
  S.apps.filter(a=>a.status==='interview').forEach(a=>out.push({ic:ICO.cal,c:'i-amber',b:`ראיון ב-${JOBS[a.jobId].co}${a.iv?', '+a.iv:''}`,s:'ההכנה מוכנה',w:['השבוע','w-soon'],go:`openPrep('${a.jobId}')`}));
  S.apps.filter(a=>a.status==='screening').forEach(a=>out.push({ic:ICO.cal,c:'i-sky',b:`שאלות סינון מ-${JOBS[a.jobId].co}`,s:'ההכנה מחכה לך',go:`openPrep('${a.jobId}')`}));
  if(q.length) out.push({ic:ICO.jobs,c:'i-green',b:q.length===1?'משרה חדשה מחכה לך':`${q.length} משרות חדשות מחכות לך`,s:q.slice(0,2).map(id=>JOBS[id].co).join(', ')+(q.length>2?` ועוד ${q.length-2}`:''),go:"goPage('jobs')"});
  S.apps.filter(followDue).forEach(a=>out.push({ic:ICO.mail,c:'i-teal',b:`${JOBS[a.jobId].co} לא ענו ${daysSince(a.date)} ימים`,s:'הודעת המשך מוכנה',go:`openApp('${a.id}','details')`}));
  S.apps.filter(a=>a.status==='saved').forEach(a=>out.push({ic:ICO.send,c:'i-green',b:`${JOBS[a.jobId].co}: שמרת ועוד לא הגשת`,s:'המכתב מוכן',go:`openApp('${a.id}','letter')`}));
  const fl=(REAL&&!CLOUDM)?0:fixesLeft().length; if(fl) out.push({ic:ICO.spark,c:'i-teal',b:fl===1?'שיפור אחד לפרופיל LinkedIn':`${fl} שיפורים לפרופיל LinkedIn`,s:'טקסט מוכן להעתקה',go:"goPage('linkedin','liFixes')"});
  return out;
}
function renderHome(){
  const h=new Date().getHours();
  const hi=h<5?'לילה טוב':h<12?'בוקר טוב':h<17?'צהריים טובים':h<21?'ערב טוב':'לילה טוב';
  const date=new Date().toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
  const steps=nextSteps(), q=queue(), iv=S.apps.find(a=>a.status==='interview'), fu=S.apps.filter(followDue);
  const saved=S.apps.filter(a=>a.status==='saved'&&JOBS[a.jobId]&&!JOBS[a.jobId].closed_at),ready=saved.filter(a=>JOBS[a.jobId].letter);
  const sug=(typeof pendingSuggestions==='function')?pendingSuggestions():[],sk=(typeof lastSkills==='function')?lastSkills():null;
  const posts=(typeof LI!=='undefined'&&LI.posts)||[],closed=(S.history||[]).filter(h=>h.reason==='closed'&&h.date&&Date.now()-new Date(h.date)<3*864e5);
  const brief=[q.length?`${N('hunter')} מצא ${q.length===1?'משרה חדשה אחת':q.length+' משרות חדשות'} שמתאימות לך.`:'עברת על כל המשרות החדשות.',
    ready.length?`${ready.length===1?`המכתב ל-${JOBS[ready[0].jobId].co} מוכן`:`${ready.length} מכתבים מוכנים`}, ${ready.length===1?'המשרה מחכה':'המשרות מחכות'} להגשה.`:saved.length?`${saved.length} משרות ששמרת מחכות להגשה.`:'',
    iv?`יש לך ראיון ב-${JOBS[iv.jobId].co}${iv.iv?' ב'+iv.iv:''}. ההכנה במסך ההכנה.`:'',
    fu.length?`${fu.map(a=>JOBS[a.jobId].co).join(' ו-')} עוד לא ענו. כדאי לשלוח הודעת המשך.`:'',
    closed.length?`${closed.length===1?'משרה אחת ששמרת נסגרה':closed.length+' משרות ששמרת נסגרו'} ועברו להיסטוריה.`:'',
    sug.length?`${N('strategist')} מציע תפקיד חדש לחיפוש: ${sug.map(x=>x.value).join(', ')}.`:'',
    sk&&sk.stats.skills.cards&&sk.stats.skills.cards.length&&Date.now()-new Date(sk.created_at)<7*864e5?`${N('coach')} הכינה כרטיסי כישורים: ${sk.stats.skills.cards.map(c=>c.skill).join(', ')}.`:'',
    posts.length?`${N('linkedin')} מצא ${posts.length} פוסטים ששווה להגיב עליהם.`:''].filter(Boolean).join(' ');
  const shown=steps.slice(0,5);
  $('homeScroll').innerHTML=`
    <div class="greet"><h2 class="greet-h">${hi}, ${escB(prof().first)}</h2><p>${escB(date)}</p></div>
    ${REAL?(FEEDD&&FEEDD.generated_at&&CLOUDM?'':`<div class="notice">${FEEDD&&FEEDD.generated_at?`המשרות אמיתיות, מהחיפוש של ${N('hunter')} ${escB(feedWhen())}.`:prof().cv?`${N('hunter')} יחפש לך משרות בסריקה הקרובה (05:15 או 17:15).`:`כדי ש${N('hunter')} יתחיל לחפש, צריך קורות חיים. <button class="link" style="color:var(--brand);font-weight:600" onclick="goPage('profile')">להעלאה</button>`} ${CLOUDM?'':'מסכי LinkedIn וההכנה לראיונות עוד מציגים דוגמאות.'}</div>`):prof().key?'':`<div class="notice">מוצגות דוגמאות עד שתחבר את הסוכנים. <button class="link" style="color:var(--brand);font-weight:600" onclick="goPage('settings')">לחיבור</button></div>`}
    <div class="brief"><div class="brief-top"><span>הבריף של ${escB(N('assistant'))}</span><span class="new num">${new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span></div><p>${escB(brief)}</p></div>
    <section class="next glass" aria-labelledby="nxH"><div class="next-h"><h2 id="nxH">הצעדים הבאים</h2>${steps.length>5?`<span>5 מתוך ${steps.length}</span>`:''}</div>
      ${shown.length?shown.map(x=>`<button class="nx" onclick="${x.go}"><span class="ic ${x.c}" aria-hidden="true">${x.ic}</span><span class="tx"><b>${escB(x.b)}</b><span>${escB(x.s)}</span></span>${x.w?`<span class="when ${x.w[1]}">${x.w[0]}</span>`:''}<span class="chev" aria-hidden="true"></span></button>`).join('')
        :'<p style="padding:6px 16px 14px;color:var(--ink2);font-size:14px">אין צעדים פתוחים כרגע. הסוכנים ממשיכים לעבוד ויעדכנו אותך.</p>'}
    </section>
    <button class="today glass" id="qCard" onclick="openQuestions()"></button>
    <section class="todo glass" id="todoBox" aria-label="המשימות שלי"></section>`;
  renderQCard();renderTodo();
}
function renderQCard(){
  const el=$('qCard');if(!el)return;const {done,total}=qProgress();
  if(done>=total){el.remove();return}
  el.innerHTML=`<span class="qc-ring" style="--p:${Math.round(done/total*100)}" aria-hidden="true"><b class="num">${done}/${total}</b></span>
    <span class="today-txt"><b>ספר לסוכנים עוד עליך</b><span>${done?`נשארו ${total-done} שאלות קצרות. ממשיכים מאיפה שעצרת`:`${total} שאלות קצרות, אחת בכל מסך`}</span></span><span class="go-round" aria-hidden="true">${IC.arrow}</span>`;
}
function renderTodo(){
  const all=S.todos, left=all.filter(t=>!t.done).length, show=S.todoOpen?all:all.slice(0,4);
  $('todoBox').innerHTML=`
    <div class="todo-head"><h2>המשימות שלי</h2><span class="num">${left?`${left} פתוחות`:'הכל בוצע'}</span></div>
    <div id="todoList" role="list">${show.map(t=>`
      <div class="todo-item" role="listitem" data-id="${t.id}">
        <button class="tcheck${t.done?' done':''}" role="checkbox" aria-checked="${t.done}" aria-label="${escB(t.text)}" onclick="toggleTodo('${t.id}')"></button>
        <span class="ttext${t.done?' done':''}">${escB(t.text)}</span>
        <button class="thandle" aria-label="גרירה לשינוי הסדר" tabindex="-1"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
      </div>`).join('')}</div>
    <div class="todo-foot"><label for="todoIn" class="vh">משימה חדשה</label><input id="todoIn" placeholder="הוסף משימה" enterkeyhint="done" onkeydown="if(event.key==='Enter')addTodo()"><button class="btn btn-sm btn-ghost" onclick="addTodo()">הוסף</button>${all.length>4?`<button class="todo-more" onclick="S.todoOpen=!S.todoOpen;save();renderTodo()">${S.todoOpen?'פחות':`הכל (${all.length})`}</button>`:''}</div>`;
  $('todoBox').querySelectorAll('.thandle').forEach(bindTodoDrag);
}
function toggleTodo(id){const t=S.todos.find(x=>x.id===id);t.done=!t.done;save();renderTodo()}
function addTodo(){const v=$('todoIn').value.trim();if(!v){$('todoIn').focus();return}S.todos.unshift({id:'t'+Date.now(),text:v,done:false});save();renderTodo();$('todoIn').focus();toast('המשימה נוספה')}
function bindTodoDrag(h){
  h.addEventListener('pointerdown',e=>{
    const item=h.closest('.todo-item'),list=$('todoList');item.classList.add('dragging');h.setPointerCapture(e.pointerId);
    const mv=ev=>{const others=[...list.querySelectorAll('.todo-item:not(.dragging)')];const nxt=others.find(o=>{const r=o.getBoundingClientRect();return ev.clientY<r.top+r.height/2});nxt?list.insertBefore(item,nxt):list.appendChild(item)};
    const up=()=>{item.classList.remove('dragging');h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
      const ids=[...list.querySelectorAll('.todo-item')].map(n=>n.dataset.id);S.todos=[...ids.map(id=>S.todos.find(t=>t.id===id)),...S.todos.filter(t=>!ids.includes(t.id))];save()};
    h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
  });
}

/* ═════════ משרות חדשות ═════════ */
let lastAct=null, busy=false;
function renderJobs(){
  $('addJobBtn').hidden=!CLOUDM;
  const q=queue(),done=DECK.length-q.length,saved=DECK.filter(id=>S.decisions[id]==='save').length;
  const skipped=DECK.filter(id=>S.decisions[id]&&S.decisions[id]!=='save').length;
  $('jobsCount').innerHTML=q.length?`<b>${q.length===1?'נשארה משרה אחת':`נשארו ${q.length} משרות`}</b><span>מתוך ${DECK.length}</span>`:`<b>עברת על כל ${DECK.length} המשרות</b>`;
  $('jobsFiltered').textContent=[saved&&`${saved} נשמרו`,skipped&&`${skipped} דילגת`,FILTERED_OUT&&`${FILTERED_OUT} סוננו כבכירות`].filter(Boolean).join(' · ');
  $('deckProg').innerHTML=`<span class="dp-fill" style="width:${DECK.length?Math.round(done/DECK.length*100):0}%"></span>`;
  $('deckProg').setAttribute('aria-hidden','true');
  const deck=$('deck');
  if(!q.length){
    $('deckActions').style.display='none';
    const sv=S.apps.filter(a=>a.status==='saved').length;
    deck.innerHTML=`<div class="empty"><div class="empty-ic">✓</div><h3>סיימת את המשרות של היום</h3><p>${escB(N('hunter'))} יחפש שוב בסריקה הבאה (05:15 או 17:15).${sv?(sv===1?' בינתיים משרה אחת ששמרת מחכה להגשה.':` בינתיים ${sv} משרות ששמרת מחכות להגשה.`):''}</p>${sv?`<button class="btn btn-primary" onclick="goPage('apps')">להגשות</button>`:`<button class="btn btn-ghost" onclick="goPage('main')">ללוח הבקרה</button>`}</div>`;
    return;
  }
  $('deckActions').style.display='';
  deck.innerHTML=q.slice(0,3).reverse().map((id,ri,arr)=>{
    const pos=arr.length-1-ri;const j=JOBS[id];
    return`<article class="jcard${pos===1?' behind':pos===2?' behind2':''}" data-id="${id}" ${pos?'aria-hidden="true"':`aria-label="${escB(j.title)} ב-${escB(j.co)}, התאמה ${j.fit} מתוך 5"`}>${cardInner(j)}${pos===0?'<span class="stamp save" aria-hidden="true">שמור</span><span class="stamp skip" aria-hidden="true">דלג</span>':''}</article>`;
  }).join('');
  bindSwipe(deck.querySelector('.jcard:not(.behind):not(.behind2)'));
}
function fitLbl(f){return f>=4.3?'התאמה חזקה':f>=4?'התאמה טובה':'שווה בדיקה'}
function pills(f){const full=Math.floor(f),part=f-full;return`<div class="pills" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i>${i<full?'<b></b>':i===full&&part>0?`<b style="right:${((1-part)*100).toFixed(0)}%"></b>`:''}</i>`).join('')}</div>`}
function cardInner(j){
  return`<div class="jc-top">${logo(j)}<div style="flex:1;min-width:0"><div class="jc-title" dir="${dirOf(j.title)||'auto'}" style="text-align:right">${escB(j.title)}</div><div class="jc-co">${escB(j.co)} · ${escB(j.loc)}</div></div></div>
    <div class="fit"><div class="fit-num num">${j.fit.toFixed(1)}<small>/5</small></div><div class="fit-right"><div class="fit-lbl">${fitLbl(j.fit)}</div>${pills(j.fit)}</div></div>
    <div class="jc-reasons">${j.reasons.slice(0,2).map(r=>`<div class="jc-r"><span class="ic ok" aria-hidden="true">✓</span><span>${escB(r)}</span></div>`).join('')}${j.gaps.slice(0,1).map(g=>`<div class="jc-r"><span class="ic gap" aria-hidden="true">!</span><span>חסר: ${escB(g)}</span></div>`).join('')}</div>
    <div class="jc-desc" dir="auto">${escB(j.desc)}</div>
    <div class="jc-tags">${j.tags.map(t=>`<span class="chip" lang="en">${escB(t)}</span>`).join('')}</div>
    <div class="jc-foot"><span>${escB(j.src)} · ${agoTxt(j.posted)}</span>${j.salary?`<span>${escB(j.salary)}</span>`:''}</div>`;
}
function bindSwipe(card){
  if(!card)return;
  let sx=0,dx=0,on=false;
  const st=card.querySelector('.stamp.save'),sk=card.querySelector('.stamp.skip');
  card.addEventListener('pointerdown',e=>{if(busy)return;on=true;sx=e.clientX;dx=0;card.setPointerCapture(e.pointerId);card.style.transition='none'});
  card.addEventListener('pointermove',e=>{if(!on)return;dx=e.clientX-sx;card.style.transform=`translateX(${dx}px) rotate(${dx*.05}deg)`;st.style.opacity=Math.max(0,Math.min(1,dx/90));sk.style.opacity=Math.max(0,Math.min(1,-dx/90))});
  const end=()=>{if(!on)return;on=false;
    if(Math.abs(dx)>90) decide(dx>0?'save':'skip');
    else if(Math.abs(dx)<6){card.style.transform='';openJobInfo()}
    else{card.style.transition='transform .4s cubic-bezier(.2,.9,.3,1.25)';card.style.transform='';st.style.opacity=0;sk.style.opacity=0}};
  card.addEventListener('pointerup',end);card.addEventListener('pointercancel',end);
}
function decide(kind){
  const q=queue();if(!q.length||busy)return;
  track('job_'+kind);
  const id=q[0],j=JOBS[id],card=$('deck').querySelector(`.jcard[data-id="${id}"]`);
  busy=true;
  if(card){card.classList.add('fly');card.style.transform=`translateX(${kind==='save'?130:-130}%) rotate(${kind==='save'?14:-14}deg)`;card.style.opacity='0';}
  S.decisions[id]=kind;
  if(kind==='save'&&!S.apps.find(a=>a.jobId===id)) S.apps.unshift({id:'a-'+id,jobId:id,status:'saved',date:new Date().toISOString(),letter:REAL?'':letterFor(j)});
  save();lastAct={id,kind};
  setTimeout(()=>{busy=false;renderJobs();syncChrome()},340);
  if(kind==='save') toast(`${j.co} נשמרה בהגשות`,{undo:undoLast});
  else toast('למה זה לא מתאים?',{undo:undoLast,ms:5200,chips:['בכירה מדי','מיקום','טכנולוגיה','לא מעניין אותי'].map(t=>({t,fn:()=>{S.skipReasons[id]=t;save();toast('הבנתי. אציג פחות משרות כאלה')}}))});
}
function undoLast(){
  if(!lastAct)return;const{id,kind}=lastAct;delete S.decisions[id];delete S.skipReasons[id];
  if(kind==='save') S.apps=S.apps.filter(a=>!(a.jobId===id&&a.status==='saved'));
  save();lastAct=null;renderJobs();syncChrome();
}
function openJobInfo(id){
  id=id||queue()[0];if(!id)return;const j=JOBS[id];const inDeck=queue()[0]===id;
  openSheet(`<div style="display:flex;gap:13px;align-items:center">${logo(j)}<div style="min-width:0"><h3 id="sheetTitle" dir="${dirOf(j.title)||'auto'}" style="text-align:right">${escB(j.title)}</h3><div class="sheet-sub">${escB(j.co)} · ${escB(j.loc)}</div></div></div>
    <div class="fit" style="margin:16px 0 0"><div class="fit-num num">${j.fit.toFixed(1)}<small>/5</small></div><div class="fit-right"><div class="fit-lbl">${fitLbl(j.fit)}</div>${pills(j.fit)}</div></div>
    ${j.reasons.length?`<div class="s-sec"><h4>למה זה מתאים לך</h4>${j.reasons.map(r=>`<div class="jc-r" style="margin-bottom:7px"><span class="ic ok" aria-hidden="true">✓</span><span>${escB(r)}</span></div>`).join('')}</div>`:''}
    ${j.warn?`<div class="s-sec"><p style="font-size:13px;color:var(--warn,#b7791f)">⚠ דורון קרא שוב את המודעה המלאה: ${escB(j.warn)}. שמרת אותה, אז היא נשארת אצלך.</p></div>`:''}
    ${j.partial?`<div class="s-sec"><p style="font-size:13px;color:var(--ink3)">לא היה תיאור מלא של המשרה, אז הדירוג לפי הכותרת בלבד ולא נכתב מה חסר.</p></div>`:''}
    ${j.gaps.length?`<div class="s-sec"><h4>מה חסר</h4>`:'<div hidden>'}${j.gaps.map(g=>`<div class="jc-r" style="margin-bottom:7px"><span class="ic gap" aria-hidden="true">!</span><span>${escB(g)}</span></div>`).join('')}</div>
    <div class="s-sec"><h4>על המשרה</h4><p dir="auto" style="font-size:14px;line-height:1.65;color:var(--ink2);text-align:start">${escB(j.desc)}</p></div>
    <div class="s-sec"><h4>פרטים</h4><div class="kv"><span>שכר</span><b>${escB(salaryTxt(j))}</b></div><div class="kv"><span>פורסם</span><b>${escB(j.src)}, ${agoTxt(j.posted)}</b></div></div>
    ${j.url?`<a class="btn btn-ghost" style="margin-top:14px;width:100%" href="${escB(j.url)}" target="_blank" rel="noopener">למודעה המלאה ב-${escB(j.src)} ↗</a>`:''}
    ${CLOUDM?`<button class="btn btn-ghost" style="margin-top:8px;width:100%" onclick="askAboutJob('${id}')">לשאול את ${escB(N('assistant'))} על המשרה</button>`:''}
    ${inDeck?`<div class="duo" style="margin-top:20px"><button class="btn btn-ghost" onclick="closeSheet();decide('skip')">דלג</button><button class="btn btn-primary" style="flex:2" onclick="closeSheet();decide('save')">שמור</button></div>`:''}`);
}

/* ═════════ כיוון טקסט בכל המסכים: עברית או טקסט משולב — מימין לשמאל; אנגלית — משמאל לימין ═════════ */
const HEB_RE=/[\u0590-\u05FF]/,LAT_RE=/[A-Za-z]/;
const BIDI_SEL='textarea,.msg,.copybox,.post-text,.jc-desc,.jc-r>span:last-child,.hint,.wf-out,.task p,.task li>span,.q .qtxt,.om-tx p,.s-sec p,.card-sub,.hist-row b,.act-card>span,.src-list span,.toast-row>span';
const BIDI_HEAD='.sheet-sub,.app-sub,.jc-co,.wf-agent,.jc-title,.app-title,#sheetTitle,.prep-jobs b';  // כותרות: כיוון לפי התוכן, יישור נשאר לימין
function dirOf(t){return HEB_RE.test(t)?'rtl':LAT_RE.test(t)?'ltr':''}
function applyDir(el,head){const d=dirOf(el.tagName==='TEXTAREA'?el.value:el.textContent);if(!d)return;
  el.dir=d;el.style.direction=d;if(!head)el.style.textAlign=d==='ltr'?'left':'right';else el.style.textAlign='right'}
function fixDirs(root){if(!root||!root.querySelectorAll)return;
  if(root.matches){if(root.matches(BIDI_SEL))applyDir(root);else if(root.matches(BIDI_HEAD))applyDir(root,true)}
  root.querySelectorAll(BIDI_SEL).forEach(e=>applyDir(e));root.querySelectorAll(BIDI_HEAD).forEach(e=>applyDir(e,true))}
let _bidiQ=new Set(),_bidiT=0;
new MutationObserver(ms=>{ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)_bidiQ.add(n);else if(n.parentElement)_bidiQ.add(n.parentElement)}));
  if(!_bidiT)_bidiT=requestAnimationFrame(()=>{_bidiT=0;_bidiQ.forEach(fixDirs);_bidiQ.clear()})}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA')applyDir(e.target)});
