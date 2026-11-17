/* ═════════ הגשות ═════════ */
/* מסלול הגשה (סבב 1, מפרט claude/findjob-apps-track-spec.md): שלבים, steps, שאלה בכרטיס, "מה השלב הבא?", משפך, 4 קבוצות */
const TRACK=['applied','screening','task','interview','offer'];
const REACH={applied:1,screening:2,task:3,interview:4,offer:5,accepted:6};
/* הגשה ישנה בלי steps: נבנה מ-date ו-status הקיימים (אותה הגשה, רק תוויות חדשות) */
function stepsOf(a){if(!a.steps){const at=a.date||new Date().toISOString(),st=[{k:'saved',at,by:'user'}];
    if(a.status!=='saved'&&a.status!=='closed')st.push({k:'applied',at,by:'user'});
    if(!['saved','applied','closed'].includes(a.status))st.push({k:a.status,at,by:'user'});
    if(a.status==='interview')a.round=a.round||1;a.steps=st}
  return a.steps}
function addStep(a,k,extra){stepsOf(a).push({k,at:new Date().toISOString(),by:'user',...(extra||{})})}
function lastStep(a,k){const st=stepsOf(a);for(let i=st.length-1;i>=0;i--)if(!k||st[i].k===k)return st[i];return null}
function reached(a,k){return stepsOf(a).some(x=>(REACH[x.k]||0)>=REACH[k])||(REACH[a.status]||0)>=REACH[k]}
const stLabel=a=>a.status==='interview'&&a.round>1?`ראיון ${a.round}`:STATUSES[a.status];
const WD=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
function whenTxt(iso){if(!iso)return'';const d=new Date(iso),t=d.toTimeString().slice(0,5),hasT=t!=='00:00',dd=Math.round((new Date(d.toDateString())-new Date(new Date().toDateString()))/DAY);
  const day=dd===0?'היום':dd===1?'מחר':dd>1&&dd<7?`ביום ${WD[d.getDay()]}`:`ב-${d.getDate()}.${d.getMonth()+1}`;return day+(hasT?` ב-${t}`:'')}
const lettered=j=>!CLOUDM||!!(j.letter&&j.letter.text);
function nowTxt(a){const j=JOBS[a.jobId],w=a.when,past=w&&new Date(w)<new Date(new Date().toDateString());
  switch(a.status){
    case'saved':return lettered(j)?'מכתב הפנייה מוכן · עוד לא הוגש':'עוד לא הוגש';
    case'applied':{const d=daysSince((lastStep(a,'applied')||{}).at||a.date);return d<1?'הוגשה היום · ממתינים לתשובה':`ממתינים לתשובה כבר ${d} ימים`}
    case'screening':return w?(past?`השיחה הראשונה הייתה ${whenTxt(w).replace(/^ב-/,'ב-')}`:`שיחה ראשונה ${whenTxt(w)}`):'שיחה ראשונה · עוד אין מועד';
    case'task':return w?(past?'המטלה הוגשה? אפשר לעדכן':`מטלה להגשה עד ${new Date(w).getDate()}.${new Date(w).getMonth()+1}`):'מטלה או מבחן · עוד אין מועד';
    case'interview':{const n=a.round>1?`ראיון ${a.round}`:'ראיון',prep=REAL?(j.prep?' · ההכנה מוכנה':''):' · ההכנה מוכנה';
      return w?(past?`${n} היה ${whenTxt(w)}`:`${n} ${whenTxt(w)}${prep}`):a.iv?`${n} ${a.iv}${prep}`:`${n} · עוד אין מועד`}
    case'offer':return'קיבלת הצעה';
    case'accepted':return'התקבלת 🎉';
    case'rejected':return a.stop&&a.stop!=='applied'?`הסתיים אחרי ה${a.stop==='interview'?'ראיון':a.stop==='task'?'מטלה':a.stop==='screening'?'שיחה הראשונה':'הצעה'}`:'הסתיים אחרי ההגשה';
    case'ghosted':return'לא התקבלה תשובה';case'withdrew':return'ויתרת על המשרה';case'closed':return'המשרה נסגרה לפני ההגשה';}
  return''}
/* השאלה בכרטיס: אחרי "הגשתי", ואחרי שיחה/מטלה/ראיון מהיום שאחרי התאריך. "עוד אין תשובה" מסתיר ל-7 ימים */
function askOf(a){if(a.snooze&&new Date(a.snooze)>new Date())return null;
  if(a.status==='applied'&&daysSince((lastStep(a,'applied')||{}).at||a.date)>=30)return{q:`עדיין אין תשובה מ-${JOBS[a.jobId].co}? לסמן 'אין מענה'?`,ghost:true};
  if(a.status==='applied')return{q:'קיבלת תשובה?',yes:'ממשיכים איתי',strong:daysSince((lastStep(a,'applied')||{}).at||a.date)>=5};
  if(['screening','task','interview'].includes(a.status)&&!(a.iv&&!a.when)){const w=a.when,since=daysSince((lastStep(a)||{}).at||a.date);
    if(w?new Date(w)<new Date(new Date().toDateString()):since>=3)return{q:a.status==='task'?'איך הלך עם המטלה?':'איך היה?',yes:'עברתי לשלב הבא',strong:true}}
  if(a.status==='offer')return{q:'מה החלטת?',offer:true};
  return null}
function askHtml(a){const k=askOf(a);if(!k)return'';
  if(k.ghost)return`<div class="ask strong"><span class="ask-q">${escB(k.q)}</span><div class="ask-btns"><button class="btn btn-sm btn-primary" onclick="endApp('${a.id}','ghosted')">לסמן אין מענה</button><button class="btn btn-sm btn-ghost" onclick="openNext('${a.id}')">ממשיכים איתי</button><button class="btn btn-sm btn-ghost" onclick="snoozeAsk('${a.id}')">עוד מחכה</button></div></div>`;
  if(k.offer)return`<div class="ask"><span class="ask-q">${k.q}</span><div class="ask-btns"><button class="btn btn-sm btn-primary" onclick="endApp('${a.id}','accepted')">קיבלתי את ההצעה</button><button class="btn btn-sm btn-ghost" onclick="endApp('${a.id}','withdrew')">דחיתי</button></div></div>`;
  return`<div class="ask${k.strong?' strong':''}"><span class="ask-q">${k.q}</span><div class="ask-btns"><button class="btn btn-sm btn-primary" onclick="openNext('${a.id}')">${k.yes}</button><button class="btn btn-sm btn-ghost" onclick="endApp('${a.id}','rejected')">לא ממשיכים</button><button class="btn btn-sm btn-ghost" onclick="snoozeAsk('${a.id}')">עוד אין תשובה</button></div></div>`}
/* השאלה נפתחת בחלון קטן (בכרטיס רק תווית). "לעבור עליהן": אחת אחרי השנייה */
let askQ=[];
function openAsk(id,queue){if(queue)askQ=queue.slice();const a=appOf(id),j=JOBS[a.jobId];
  openSheet(`<div style="display:flex;gap:12px;align-items:center">${logo(j)}<div style="min-width:0"><h3 id="sheetTitle" dir="${dirOf(j.title)||'auto'}" style="text-align:right">${escB(j.title)}</h3><div class="sheet-sub">${escB(j.co)} · ${escB(nowTxt(a))}</div></div></div>
    ${askHtml(a)}${askQ.length>1?`<p class="hint-line" style="margin-top:10px">עוד ${askQ.length-1} אחרי זו</p>`:''}`);
  document.querySelectorAll('#sheet .ask-btns button').forEach(b=>b.addEventListener('click',()=>setTimeout(nextAsk,400)))}
function nextAsk(){askQ.shift();const n=askQ.find(id=>appOf(id)&&askOf(appOf(id)));if(n&&!document.querySelector('#sheet .next-grid'))openAsk(n)}
/* תשובה מהתראה: /#ask=<id>&a=yes|no|wait. בלי כפתור (iOS): נפתח חלון השאלה */
function askFromHash(){const m=(location.hash||'').match(/ask=([^&]+)(?:&a=(\w+))?/);if(!m)return;const a=appOf(decodeURIComponent(m[1]));
  history.replaceState(null,'',location.pathname+location.search);if(!a)return;track('push_answer',{a:m[2]||'open'});
  if(m[2]==='yes'){if(curPg!=='apps')goPage('apps');openNext(a.id)}else if(m[2]==='no')endApp(a.id,'rejected');else if(m[2]==='wait')snoozeAsk(a.id);else openAsk(a.id)}
/* הדבקת מייל מהחברה: שי מסווג ומציע עדכון. רק באישור */
const MAIL_K={rejection:['rejected','לא ממשיכים'],screening:['screening','שיחה ראשונה'],task:['task','מטלה או מבחן'],interview:['interview','ראיון'],offer:['offer','הצעה']};
function openMail(id){const a=appOf(id),j=JOBS[a.jobId];
  openSheet(`<h3 id="sheetTitle">הדבקת מייל מהחברה</h3><div class="sheet-sub">${escB(j.co)} · ${escB(N('assistant'))} יקרא ויציע עדכון. שום דבר לא משתנה בלי אישור</div>
    <label for="mailTx" class="vh">המייל</label><textarea id="mailTx" class="textbox" rows="8" placeholder="הדבק כאן את המייל שקיבלת"></textarea>
    <p class="hint-line" id="mailRes" aria-live="polite"></p><button class="btn btn-primary btn-block" id="mailBtn" onclick="parseMail('${id}')">לקרוא את המייל</button>`)}
async function parseMail(id){const a=appOf(id),j=JOBS[a.jobId],t=($('mailTx').value||'').trim(),out=$('mailRes'),btn=$('mailBtn');
  if(t.length<40){out.textContent='המייל קצר מדי';return}track('mail_paste');btnBusy(btn,true);out.textContent=`${N('assistant')} קורא…`;let d={};
  try{const {data:{session}}=await SB.auth.getSession();const r=await fetch('/api/mailparse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t,co:j.co,title:j.title,token:session&&session.access_token})});d=await r.json().catch(()=>({}))}catch(e){d={error:'net'}}
  btnBusy(btn,false);const k=MAIL_K[d.kind];
  if(!k){out.textContent=d.error?'משהו השתבש. נסה שוב בעוד דקה.':`לא ברור מהמייל מה השלב הבא${d.summary?': '+d.summary:''}. אפשר לעדכן ידנית ב"שינוי שלב".`;return}
  out.innerHTML=`${escB(d.summary||'')}<br><b>להציע: ${k[1]}${d.when?' · '+escB(whenTxt(d.when)):''}${d.contact?' · '+escB(d.contact):''}</b>`;
  btn.textContent='לעדכן';btn.onclick=()=>{closeSheet();if(k[0]==='rejected'){endApp(id,'rejected');return}
    const prev=JSON.stringify(a);if(k[0]==='interview')a.round=a.status==='interview'?(a.round||1)+1:1;
    addStep(a,k[0],{by:'mail',...(d.contact?{note:d.contact}:{}),...(k[0]==='interview'?{round:a.round}:{})});a.status=k[0];a.when=d.when?new Date(d.when).toISOString():'';delete a.snooze;
    save();refreshApps();toast(`עודכן מהמייל: ${stLabel(a)}`,{undo:()=>{const o=JSON.parse(prev);Object.keys(a).forEach(x=>delete a[x]);Object.assign(a,o);save();refreshApps()},ms:6000})}}
function reviewWaiting(){const q=S.apps.filter(a=>groupOf(a)==='waiting'&&askOf(a)).map(a=>a.id);if(q.length)openAsk(q[0],q)}
function trackHtml(a){if(a.status==='saved'||a.status==='closed')return'';
  const had=stepsOf(a).some(x=>x.k==='task')||a.status==='task',keys=TRACK.filter(k=>k!=='task'||had),
    cur=a.status==='rejected'||a.status==='ghosted'||a.status==='withdrew'?(a.stop||lastReal(a)):a.status==='accepted'?'offer':a.status,ci=keys.indexOf(cur),
    stop=a.status==='rejected',L={applied:'הגשתי',screening:'שיחה',task:'מטלה',interview:'ראיון',offer:'הצעה'};
  return`<ol class="trk${stop?' stopped':''}" aria-label="מסלול ההגשה">${keys.map((k,i)=>{const c=i<ci?'done':i===ci?(stop?'stop':'cur'):'next';
    return`<li class="${c}" aria-label="${L[k]}: ${c==='done'?'עבר':c==='cur'?'עכשיו':c==='stop'?'נעצר כאן':'עוד לא'}"><i></i><span>${L[k]}</span></li>`}).join('')}</ol>`}
function lastReal(a){const st=stepsOf(a).filter(x=>TRACK.includes(x.k));return st.length?st[st.length-1].k:'applied'}
/* קבוצות: שיחה/ראיון/מטלה/הצעה תמיד ב"בתהליך" (גם כשהם השבוע, עם סימון), "פתוחות" = עוד לא הוגש, "ארכיון" = נסגרו */
function groupOf(a){if(CLOSED.includes(a.status))return'closed';
  if(['screening','task','interview','offer'].includes(a.status))return'progress';
  if(a.status==='saved')return'open';
  return'waiting'}
function soonOf(a){const w=a.when&&new Date(a.when);return !!(w&&w>=new Date(new Date().toDateString())&&(w-new Date())<7*DAY)}
function appCard(a){const j=JOBS[a.jobId],g=groupOf(a),k=askOf(a);
  return`<div class="swipe" data-id="${a.id}"><div class="swipe-bg" aria-hidden="true"><span>הסרה</span><span>הסרה</span></div><article class="app glass row-app g-${g}${CLOSED.includes(a.status)?' dim':''}">
    <button class="app-top" style="width:100%;text-align:right" onclick="openApp('${a.id}')" aria-label="${escB(j.title)} ב-${escB(j.co)}, ${stLabel(a)}, ${escB(nowTxt(a))}">
      ${logo(j)}<span class="app-info"><span class="app-title" dir="${dirOf(j.title)||'auto'}" style="display:block;text-align:right">${escB(j.title)}</span><span class="app-sub" style="display:block">${escB(j.co)} · ${escB(nowTxt(a))}${j.closed_at&&!CLOSED.includes(a.status)?' · המשרה נסגרה':''}</span></span>
      ${soonOf(a)&&!CLOSED.includes(a.status)?'<span class="wk-tag">השבוע</span>':''}<span class="status st-${a.status}">${stLabel(a)}</span></button>
    ${k&&g!=='waiting'?`<button class="ask-tag" onclick="openAsk('${a.id}')">${escB(k.q)} ←</button>`:''}
  </article></div>`}
/* המספרים: בלוח הבקרה (משפך) ובשורה אחת במחשב. מסקנות רק מ-8 הגשות ו-4 תשובות */
function funnelNums(){const live=S.apps.filter(a=>a.status!=='saved'&&a.status!=='closed'),n=k=>live.filter(a=>reached(a,k)).length;
  return{apps:live.length,talks:n('screening'),ivs:n('interview'),offers:n('offer'),answers:live.filter(a=>a.status!=='applied').length,
    early:live.filter(a=>a.status==='rejected'&&(a.stop||'applied')==='applied').length,late:live.filter(a=>a.status==='rejected'&&a.stop&&a.stop!=='applied').length,ghost:live.filter(a=>a.status==='ghosted').length}}
function funnelInsight(){const f=funnelNums();if(f.apps<8||f.answers<4)return'';
  if(f.early>=Math.max(3,f.answers*.5))return`רוב הדחיות מגיעות לפני שיחה (${f.early} מ-${f.answers}). כדאי לחזק את קורות החיים ואת בחירת המשרות.`;
  if(f.late>=3)return`${f.late} תהליכים נעצרו אחרי שיחה או ראיון. תרגול עם ${N('coach')} יכול לעזור.`;
  if(f.ghost>=3)return`${f.ghost} הגשות בלי מענה בכלל. הודעת המשך שבוע אחרי ההגשה מעלה את הסיכוי לתשובה.`;
  return''}
function funnelHtml(){const f=funnelNums(),c=[['הגשות',f.apps],['שיחות',f.talks],['ראיונות',f.ivs],['הצעות',f.offers]],ins=funnelInsight();
  return`<button class="funnel card glass" onclick="goPage('apps')" aria-label="ההגשות שלך: ${c.map(([l,v])=>v+' '+l).join(', ')}">${c.map(([l,v])=>`<span class="fn"><b class="num">${v}</b><span>${l}</span></span>`).join('')}
    <span class="fn-bar" aria-hidden="true">${c.map(([,v])=>`<i style="flex:${Math.max(v,0.2)}" class="${v?'on':''}"></i>`).join('')}</span>${ins?`<span class="fn-ins">${escB(ins)}</span>`:''}</button>`}
let appGrp=null;
const GRP=[['open','פתוחות'],['progress','בתהליך'],['waiting','ממתינות'],['closed','ארכיון']];
function renderApps(){S.apps.forEach(stepsOf);
  if(!S.apps.length){$('seg').innerHTML='';$('appsList').innerHTML=historyHtml(true)+`<div class="empty"><div class="empty-ic">📋</div><h3>עוד אין הגשות</h3><p>משרות ששמרת יופיעו כאן, עם מכתב פנייה מוכן.</p><button class="btn btn-primary" onclick="goPage('jobs')">למשרות</button></div>`;return}
  const by={open:[],progress:[],waiting:[],closed:[]};S.apps.forEach(a=>by[groupOf(a)].push(a));
  const when=a=>a.when?new Date(a.when).getTime():9e15;
  by.open.sort((x,y)=>when(x)-when(y));by.progress.sort((x,y)=>(soonOf(y)-soonOf(x))||((REACH[y.status]||0)-(REACH[x.status]||0)));
  by.waiting.sort((x,y)=>(x.status==='saved')-(y.status==='saved')||new Date(x.date)-new Date(y.date));   // הוותיקות ראשונות, "עוד לא הוגש" בסוף
  by.closed.sort((x,y)=>new Date((lastStep(y)||{}).at||y.date)-new Date((lastStep(x)||{}).at||x.date));
  if(!appGrp||!by[appGrp].length)appGrp=GRP.map(([k])=>k).find(k=>by[k].length);
  const dot=k=>k!=='closed'&&by[k].some(a=>askOf(a)||k==='open');
  $('seg').innerHTML=GRP.map(([k,l])=>`<button class="chip c-${k}${appGrp===k?' sel':''}" role="tab" aria-selected="${appGrp===k}" onclick="appGrp='${k}';renderApps()">${l} <b class="num">${k==='closed'?by[k].length+histList().length:by[k].length}</b>${dot(k)&&by[k].length?'<span class="tab-dot" aria-label="מחכה לך"></span>':''}</button>`).join('');
  const nAsk=by.waiting.filter(a=>askOf(a)).length;
  const prepRow=CLOUDM&&S.apps.some(a=>a.status==='saved')?`<div style="margin-bottom:10px">${prepBtn('prep','לעדכן הכל עכשיו','btn btn-sm btn-ghost btn-block')}</div>`:'';
  const f=funnelNums(),line=`<p class="apps-line">${GRP.map(([k,l])=>`${by[k].length} ${l}`).join(' · ')} · ${f.ivs} ראיונות · ${f.offers} הצעות</p>`;
  const col=k=>`<section class="app-group g-${k}${appGrp===k?' on':''}" role="tabpanel"><h3 class="grp-h">${GRP.find(x=>x[0]===k)[1]} <span class="num">${by[k].length}</span></h3>
      ${k==='waiting'&&nAsk?`<button class="review-link" onclick="reviewWaiting()">קיבלת תשובה מאחת החברות? לעדכן ←</button>`:''}
      ${k==='closed'?archiveHtml(by.closed):(by[k].map(appCard).join('')||'<p class="grp-empty">אין כאן כרגע</p>')}</section>`;
  $('appsList').innerHTML=line+prepRow+`<div class="app-groups">${GRP.map(([k])=>col(k)).join('')}</div>`;
  bindAppSwipes();setTimeout(askFromHash,0);
}
/* "מה השלב הבא?": 4 אפשרויות, "מתי?" (אפשר להשאיר ריק), שמירה. אחרי ראיון מוצע ראיון נוסף */
const NEXT=[['screening','שיחה ראשונה','היכרות קצרה, בדרך כלל עם גיוס'],['task','מטלה או מבחן','מטלת בית, מבחן אונליין או שאלון'],['interview','ראיון','מקצועי, מנהל או HR'],['offer','הצעה','קיבלתי הצעה']];
let nextPick=null;
function openNext(id){const a=appOf(id),j=JOBS[a.jobId];nextPick=a.status==='interview'||a.status==='task'||a.status==='screening'?'interview':'screening';
  openSheet(`<h3 id="sheetTitle">מה השלב הבא?</h3><div class="sheet-sub">${escB(j.title)} · ${escB(j.co)}</div>
    <div class="next-grid" role="radiogroup" aria-label="השלב הבא">${NEXT.map(([k,l,d])=>`<button class="next-opt${k===nextPick?' sel':''}" role="radio" aria-checked="${k===nextPick}" data-k="${k}" onclick="nextPick='${k}';document.querySelectorAll('.next-opt').forEach(b=>{b.classList.toggle('sel',b.dataset.k===nextPick);b.setAttribute('aria-checked',b.dataset.k===nextPick)})"><b>${k==='interview'&&a.status==='interview'?`ראיון ${(a.round||1)+1}`:l}</b><span>${d}</span></button>`).join('')}</div>
    <div class="field"><label for="nxWhen">מתי? (אפשר להשאיר ריק)</label><input id="nxWhen" type="datetime-local"></div>
    <button class="btn btn-primary btn-block" onclick="saveNext('${id}')">שמירה</button>`)}
function saveNext(id){const a=appOf(id),prev=JSON.stringify(a),k=nextPick,w=$('nxWhen')&&$('nxWhen').value;
  if(k==='interview')a.round=a.status==='interview'?(a.round||1)+1:1;
  addStep(a,k,k==='interview'?{round:a.round}:null);a.status=k;a.when=w?new Date(w).toISOString():'';delete a.snooze;delete a.iv;
  track('app_'+k);save();closeSheet();refreshApps();
  toast(`עודכן: ${stLabel(a)}${w?' '+whenTxt(a.when):''}`,{undo:()=>{Object.assign(a,JSON.parse(prev));Object.keys(a).forEach(x=>{if(!(x in JSON.parse(prev)))delete a[x]});save();refreshApps()},ms:6000})}
/* סיום: לא ממשיכים / התקבלתי / דחיתי. נשמר באיזה שלב נעצר (מזין את המשפך). ביטול 6 שניות */
function endApp(id,k){const a=appOf(id),prev=JSON.stringify(a);if(k==='rejected')a.stop=a.status;
  addStep(a,k);a.status=k;a.when='';track('app_'+k);save();refreshApps();
  if(k==='rejected'){afterRejectUndo(a,prev);return}
  const msg=k==='accepted'?'מזל טוב! 🎉':k==='ghosted'?'סימנתי: אין מענה':'עודכן: דחית את ההצעה';
  toast(msg,{undo:()=>{const o=JSON.parse(prev);Object.keys(a).forEach(x=>delete a[x]);Object.assign(a,o);save();refreshApps()},ms:6000})}
function afterRejectUndo(a,prev){const j=JOBS[a.jobId];
  toast(`אין המשך בתהליך מול ${j.co}. זה חלק מהדרך.`,{ms:9000,undo:()=>{const o=JSON.parse(prev);Object.keys(a).forEach(x=>delete a[x]);Object.assign(a,o);save();refreshApps()},chips:[
    {t:'בקשת משוב',fn:()=>{track('feedback_ask');toggleChat(true);chatAsk(`נסח לי מייל קצר ומנומס לבקשת משוב מ-${j.co} על התהליך לתפקיד ${j.title}. ${a.stop==='applied'?'לא עברתי את שלב ההגשה.':`התהליך הסתיים אחרי ה${STEP_TXT[a.stop]||'שלב האחרון'}.`}`)}},
    {t:'למה לדעתך?',fn:()=>setTimeout(()=>toast('למה לדעתך?',{ms:12000,chips:whyChips(a.jobId,j,'rejected',t=>{a.why=t;save();toast('תודה, דורון ילמד מזה')})}),50)}]})}
function snoozeAsk(id){const a=appOf(id);a.snooze=new Date(Date.now()+7*DAY).toISOString();save();refreshApps();
  toast('בסדר, אשאל שוב בעוד שבוע',{undo:()=>{delete a.snooze;save();refreshApps()},ms:6000})}
/* חלון משרה (סבב 2): כותרת + "עכשיו" + פעולה אחת, ציר זמן (בלי שמות סוכנים: פעולה + אייקון), הערה לכל שלב */
function appHead(a,j){if(a.status==='saved')return askHtml(a);   // שמרתי / מכתב מוכן / פתח והגש — בערכת ההגשה, לא בפרטים
  const act=['screening','task','interview'].includes(a.status)?`<button class="btn btn-primary btn-block" onclick="${REAL?`closeSheet();openPrep('${a.jobId}')`:`appTab='prep';paintAppTab('${a.id}')`}">להכנה עם ${escB(N('coach'))}</button>`
    :a.status==='offer'&&CLOUDM?`<button class="btn btn-primary btn-block" onclick="askAboutJob('${a.jobId}')">בדיקת ההצעה עם ${escB(N('assistant'))}</button>`:'';
  return`<div class="app-head"><div><span class="status st-${a.status}">${stLabel(a)}</span></div><p class="app-now">${escB(nowTxt(a))}</p>${act}${askHtml(a)}</div>`}
const STEP_TXT={saved:'נשמרה',applied:'הוגשה',screening:'שיחה ראשונה',task:'מטלה או מבחן',interview:'ראיון',offer:'הצעה',accepted:'התקבלתי',rejected:'לא ממשיכים',ghosted:'אין מענה',withdrew:'ויתרתי',closed:'המשרה נסגרה'};
const AG_EV=[['brief','researcher','חקירה על החברה'],['tailor','linkedin','התאמת קורות חיים'],['letter','assistant','כתיבת מכתב פנייה']];
let tlAll=false,tlQ=[];
function timelineHtml(a,j){const st=stepsOf(a),rows=[],ix=k=>CAREER.agents.findIndex(g=>g.key===k);
  st.forEach((x,i)=>{rows.push({i,me:true,t:STEP_TXT[x.k]+(x.k==='saved'&&j.fit?` · התאמה ${j.fit.toFixed(1)}`:'')+(x.k==='interview'&&x.round>1?` ${x.round}`:''),at:x.at,note:x.note});
    if(x.k==='saved')AG_EV.forEach(([f,ag,t])=>{if(CLOUDM?j[f]:true)rows.push({ag:ix(ag),t})});
    if(x.k==='interview'&&(CLOUDM?j.prep:true))rows.push({ag:ix('coach'),t:'הכנה לראיון'})});
  const cur=st.length-1,ended=CLOSED.includes(a.status),nx=!ended&&{saved:'הגשה',applied:'תשובה מהחברה',screening:'השלב הבא',task:'השלב הבא',interview:'השלב הבא',offer:'החלטה'}[a.status];
  tlQ=[];const show=tlAll||rows.length<=8?rows:rows.slice(-8);
  const html=show.map(r=>{if(!r.me){const q=tlQ.push(r.ag)-1;return`<li class="tl-ag"><span class="tl-dot"><canvas id="tlf-${q}" width="96" height="96"></canvas></span><span class="tl-t">${r.t}</span></li>`}
    const c=r.i===cur&&!ended?'cur':'me',d=r.at?new Date(r.at):null;
    return`<li class="tl-${c}"><span class="tl-dot"></span><span class="tl-t">${escB(r.t)}${r.note?`<q>${escB(r.note)}</q>`:''}</span><button class="tl-d" onclick="fixDate('${a.id}',${r.i},this)" aria-label="תיקון תאריך">${d?`${d.getDate()}.${d.getMonth()+1}`:'—'}</button></li>`}).join('');
  return`<ol class="tl" aria-label="ציר זמן">${!tlAll&&rows.length>8?`<li class="tl-more"><button onclick="tlAll=true;paintAppTab('${a.id}')">עוד ${rows.length-8}</button></li>`:''}${html}${nx?`<li class="tl-next"><span class="tl-dot"></span><span class="tl-t">${nx}</span></li>`:''}</ol>
    <div class="tl-note"><input id="stNote" placeholder="הוספת הערה לשלב..." aria-label="הערה לשלב הנוכחי" onkeydown="if(event.key==='Enter'){event.preventDefault();saveStepNote('${a.id}')}"><button class="btn btn-sm btn-primary" onclick="saveStepNote('${a.id}')">שמירה</button></div>`}
function tlFaces(){tlQ.forEach((ag,i)=>ag>=0&&face($('tlf-'+i),ag))}
function saveStepNote(id){const a=appOf(id),v=($('stNote').value||'').trim();if(!v)return;const st=stepsOf(a);st[st.length-1].note=v.slice(0,200);save();paintAppTab(id);toast('ההערה נשמרה')}
function fixDate(id,i,el){const a=appOf(id),x=stepsOf(a)[i];
  const inp=document.createElement('input');inp.type='date';inp.className='tl-dinp';inp.value=(x.at||'').slice(0,10);
  inp.onchange=()=>{if(inp.value){x.at=new Date(inp.value+'T12:00').toISOString();if(i===0||x.k==='applied')a.date=x.at;save();refreshApps();paintAppTab(id)}};
  el.replaceWith(inp);inp.focus();try{inp.showPicker()}catch(e){}}
/* "הגשתי": ריבוע ריק, ו-✓ ירוק אחרי סימון. לחיצה שנייה מבטלת */
function appliedBox(a,wide){const on=a.status!=='saved';
  return `<button class="chk-btn${on?' on':''}${wide?' wide':''}" role="checkbox" aria-checked="${on}" onclick="${on?`unmarkApplied('${a.id}')`:`markApplied('${a.id}')`};${wide?'paintAppTab(\''+a.id+'\')':''}"><span class="box" aria-hidden="true">${on?'✓':''}</span>הגשתי</button>`}
function unmarkApplied(id){const a=appOf(id);if(!a||a.status!=='applied')return;a.status='saved';a.steps=stepsOf(a).filter(x=>x.k!=='applied');save();refreshApps();toast('ביטלתי את הסימון. המשרה חזרה ל"שמור"')}
function markApplied(id){track('applied');const a=appOf(id);stepsOf(a);a.status='applied';a.date=new Date().toISOString();addStep(a,'applied');save();refreshApps();toast('סימנתי שהגשת. אזכיר לך לשלוח הודעת המשך בעוד שבוע')}
function refreshApps(){if(curPg==='apps')renderApps();if(curPg==='main')renderHome();if(curPg==='jobs')renderJobs();syncChrome()}

/* application sheet: details · letter · referrals · prep */
let appTab='details';
function openApp(id,tab){
  const a=appOf(id);if(!a)return;
  const hasPrep=!REAL&&(a.status==='interview'||a.status==='screening');
  appTab=tab==='prep'&&!hasPrep?'details':(tab||(a.status==='saved'?'letter':'details'));   // משרה שעוד לא הוגשה נפתחת בערכת ההגשה
  const j=JOBS[a.jobId];
  const tabs=[['details','פרטים'],['letter','ערכת הגשה'],['ref','קשרים'],...(hasPrep?[['prep',a.status==='interview'?'הכנה':'סינון']]:[])];
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
    el.innerHTML=`${appHead(a,j)}${(S.jnotes||{})[a.jobId]?`<p class="j-note">📝 ${escB(S.jnotes[a.jobId])}</p>`:''}${fitFold(j,a.jobId)}${timelineHtml(a,j)}
      <details class="s-sec app-more"><summary>פרטים</summary><div class="s-sec" style="margin-top:12px">
        <div class="kv"><span>שלב</span><button class="status st-${a.status}" onclick="openStatus('${id}')">${STATUSES[a.status]} · שינוי</button></div>
        <div class="kv"><span>${a.status==='saved'?'נשמרה':'הוגשה'}</span><b>${agoTxt(daysSince(a.date))}</b></div>
        ${a.iv?`<div class="kv"><span>ראיון</span><b>${escB(a.iv)}</b></div>`:''}
        <div class="kv"><span>שכר</span><b>${escB(salaryTxt(j))}</b></div>
        ${REAL&&a.status==='saved'?`<div class="kv"><span>פתוחה להגשה?</span><b>${openTxt(j)}</b></div>`:''}</div>
      ${fu?`<div class="s-sec"><h4>הודעת המשך</h4><textarea class="textbox" id="fuText" rows="7" aria-label="הודעת המשך">${esc(a.follow||followText(j))}</textarea>
        <div class="duo"><button class="btn btn-ghost" onclick="copyText($('fuText').value,'ההודעה הועתקה')">${ICO.copy}העתק</button><button class="btn btn-primary" onclick="sentFollow('${id}')">שלחתי</button></div></div>`:''}
      ${REAL?briefHtml(j):''}
      ${REAL?prepEntry(a,j):''}
      ${REAL?tailorLink(j,id):''}
      <div class="s-sec"><h4>עריכה</h4>
        <div class="field"><label for="edIv">מועד ראיון או שיחה</label><input id="edIv" value="${escB(a.iv||'')}" placeholder="למשל: רביעי, 14:00" onchange="appOf('${id}').iv=this.value.trim();save();refreshApps()"></div>
        <div class="field"><label for="edNote">הערות שלי</label><textarea id="edNote" class="textbox" rows="3" placeholder="עם מי דיברתי, מה ביקשו, מה הלאה…" oninput="$('edNoteBtn').disabled=this.value===(appOf('${id}').note||'')" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&matchMedia('(pointer:fine)').matches){event.preventDefault();saveNote('${id}')}">${esc(a.note||'')}</textarea>
          <div class="note-row"><span class="hint-line note-kb">Enter לשמירה · Shift+Enter לשורה חדשה</span><button class="btn btn-sm btn-primary" id="edNoteBtn" disabled onclick="saveNote('${id}')">שמירה</button></div></div></div>
      <div class="s-sec"><a class="btn btn-ghost btn-block ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener">פתח את המשרה${ICO.open}</a>
        ${CLOUDM?`<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="askAboutJob('${a.jobId}')">לשאול את ${escB(N('assistant'))} על המשרה</button>`:''}
        </div></details>
      <div class="app-foot">${CLOUDM&&!CLOSED.includes(a.status)&&a.status!=='saved'?`<button class="btn btn-ghost" onclick="openMail('${id}')">הדבקת מייל מהחברה</button>`:''}<button class="btn btn-ghost" onclick="openStatus('${id}')">שינוי שלב</button><button class="btn btn-ghost" style="color:var(--rose)" onclick="closeSheet();removeApp('${id}')">הסרה</button></div>`;
    tlFaces();
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
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="closeSheet();toggleChat(true);chatAsk('בוא נתרגל ${a.status==='interview'?'ראיון':'שיחה ראשונה'}')">לתרגל עם ${escB(N('coach'))}</button>`;
  }
}
function sentFollow(id){const a=appOf(id);a.follow=$('fuText').value;a.date=new Date().toISOString();save();closeSheet();refreshApps();toast('מעולה. אזכיר שוב בעוד שבוע אם לא יענו')}
function openStatus(id){
  const a=appOf(id),j=JOBS[a.jobId];
  openSheet(`<h3 id="sheetTitle">שלב ההגשה</h3><div class="sheet-sub">${escB(j.co)}</div><div class="s-sec" role="radiogroup" aria-label="שלב">${Object.entries(STATUSES).map(([k,l])=>`<button class="opt${a.status===k?' sel':''}" role="radio" aria-checked="${a.status===k}" onclick="setStatus('${id}','${k}')"><span class="status st-${k}">${l}</span><span class="radio" aria-hidden="true"></span></button>`).join('')}</div>`);
}
function setStatus(id,k){const a=appOf(id);if(a.status!==k){stepsOf(a);if(k==='rejected')a.stop=a.status;addStep(a,k);a.status=k;if(k==='applied')a.date=new Date().toISOString();save()}refreshApps();if(REAL&&(k==='interview'||k==='screening')){closeSheet();openPrep(appOf(id).jobId)}else openApp(id,(k==='interview'||k==='screening')?'prep':'details');toast(`השלב עודכן: ${STATUSES[k]}`)}

/* ═════════ LinkedIn ═════════ */
/* LinkedIn בלשוניות: כל כותרת אזור (.sec-h) הופכת ללשונית, כדי שלא נצטרך לגלול עמוד ארוך */
let liTab=0;
function liTabs(){const box=$('liScroll');if(!box)return;const hs=[...box.querySelectorAll(':scope > .sec-h')];if(hs.length<2)return;
  const short=t=>/פוסטים/.test(t)?'פוסטים':/פרופיל/.test(t)?'הפרופיל':/הפוסט/.test(t)?'הפוסט שלך':/אנשים/.test(t)?'אנשים':t;
  liTab=Math.min(liTab,hs.length-1);
  hs.forEach((h,i)=>{let n=h.nextElementSibling;const els=[h];while(n&&!n.classList.contains('sec-h')){els.push(n);n=n.nextElementSibling}
    const w=document.createElement('div');w.className='li-panel'+(i===liTab?' on':'');w.setAttribute('role','tabpanel');h.before(w);els.forEach(e=>w.appendChild(e))});
  const bar=document.createElement('div');bar.className='seg li-tabs';bar.setAttribute('role','tablist');
  bar.innerHTML=hs.map((h,i)=>`<button class="chip${i===liTab?' sel':''}" role="tab" aria-selected="${i===liTab}" onclick="liTab=${i};renderLinkedIn()">${escB(short(h.querySelector('h2').textContent))}</button>`).join('');
  box.querySelector('.li-panel').before(bar)}
function renderLinkedIn(){
  renderLinkedInInner();liTabs()}
function renderLinkedInInner(){
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
    ${apps.length>1?`<p class="prep-hint">ההכנה מחולקת לפי משרה · ${apps.findIndex(x=>x.jobId===prepJob)+1} מתוך ${apps.length}. בוחרים משרה כאן ${apps.length>2?'(אפשר לגלול הצידה)':''}</p>`:''}
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
/* ארכיון: הגשות שנסגרו + משרות שהוסרו או נסגרו למועמדים, עם סינון לפי סיבה */
let archF='all';
const ARCH=[['all','הכל'],['rejected','נדחו'],['ghosted','אין מענה'],['withdrew','ויתרתי'],['accepted','התקבלתי'],['closed','נסגרו למועמדים'],['removed','הוסרו']];
function histList(){return (S.history||[]).filter(h=>JOBS[h.jobId]||h.title)}
function archiveHtml(closed){const H=histList(),kind=x=>x.status||(x.reason==='removed'?'removed':'closed');
  const have=new Set([...closed.map(kind),...H.map(kind)]),F=ARCH.filter(([k])=>k==='all'||have.has(k));
  const ok=x=>archF==='all'||kind(x)===archF;
  const rows=closed.filter(ok).map(appCard).join('')+H.filter(ok).map(histRow).join('');
  return `${F.length>2?`<div class="arch-f">${F.map(([k,l])=>`<button class="chip${archF===k?' sel':''}" onclick="archF='${k}';renderApps()">${l}</button>`).join('')}</div>`:''}${rows||'<p class="grp-empty">אין כאן כרגע</p>'}`}
function histRow(h){const why={closed:'נסגרה למועמדים',removed:'הסרת'};
  return `<div class="hist-row"><span class="tx"><b dir="auto">${escB(h.title)}</b><span>${escB(h.co)} · ${why[h.reason]||''}${h.why&&h.why!=='נסגרה'?`: ${escB(h.why)}`:''} · ${new Date(h.date).toLocaleDateString('he-IL')}</span></span>
      ${h.reason==='removed'?`<button class="btn btn-sm btn-ghost" onclick="restoreApp('${h.jobId}')">להחזיר</button>`:h.url?`<a class="btn btn-sm btn-ghost ext" href="${escB(h.url)}" target="_blank" rel="noopener">למודעה${ICO.open}</a>`:''}</div>`}
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
/* פרטים לטופס מתוך קורות החיים (באנגלית, כמו בטפסים): שם, תואר, תחום, מוסד, שנים. רק מה שכתוב שם, בלי ניחוש */
const SCHOOL_EN={'HIT':'Holon Institute of Technology','Technion':'Technion - Israel Institute of Technology','Tel Aviv University':'Tel Aviv University',
  'Hebrew University':'The Hebrew University of Jerusalem','Bar-Ilan':'Bar-Ilan University','Ben-Gurion':'Ben-Gurion University of the Negev','Reichman':'Reichman University',
  'Ariel University':'Ariel University','Afeka':'Afeka Tel Aviv Academic College of Engineering','Open University':'The Open University of Israel','University of Haifa':'University of Haifa',
  'Shenkar':'Shenkar College','Ruppin':'Ruppin Academic Center','Sapir':'Sapir Academic College','Azrieli':'Azrieli College of Engineering Jerusalem','Jerusalem College of Technology':'Jerusalem College of Technology'};
function cvFacts(cv){cv=String(cv||'');const L=cv.split('\n').map(x=>x.trim()).filter(Boolean),o={};
  const nm=L.slice(0,4).map(x=>x.split(/\s[—–|-]\s|,/)[0].trim()).find(x=>/^[A-Za-z][A-Za-z.' -]{2,40}$/.test(x)&&x.split(/\s+/).length>=2&&x.split(/\s+/).length<=4);
  if(nm){o.full_en=nm;const w=nm.split(/\s+/);o.first_en=w[0];o.last_en=w.slice(1).join(' ')}
  const dl=L.find(x=>/\b(B\.?\s?Sc|B\.?\s?A|M\.?\s?Sc|M\.?\s?A|Ph\.?\s?D|B\.?\s?Eng|Practical Engineer)\b/i.test(x));
  if(dl){const d=dl.match(/\b(B\.?\s?Sc|B\.?\s?A|M\.?\s?Sc|M\.?\s?A|Ph\.?\s?D|B\.?\s?Eng|Practical Engineer)\b/i)[1].replace(/[\s.]/g,'').toLowerCase();
    o.degree={bsc:"Bachelor's Degree",ba:"Bachelor's Degree",beng:"Bachelor's Degree",msc:"Master's Degree",ma:"Master's Degree",phd:'Doctor of Philosophy (Ph.D.)',practicalengineer:'Practical Engineer'}[d]||'';
    const f=dl.match(/\bin\s+([A-Za-z &]+?)(?:[,.(–—-]|\s+at\b|\s+\d|$)/);if(f)o.discipline=f[1].trim();
    const y=dl.match(/(20\d\d|19\d\d)\s*[–—-]\s*(20\d\d|19\d\d|present|now|today)/i);if(y){o.edu_start=y[1];if(/^\d/.test(y[2]))o.edu_end=y[2]}
    else{const y1=dl.match(/\b(20\d\d)\b/);if(y1)o.edu_end=y1[1]}}
  const sk=Object.keys(SCHOOL_EN).find(k=>cv.toLowerCase().includes(k.toLowerCase()));if(sk)o.school=SCHOOL_EN[sk];
  return o}
/* ציפיות השכר מהשאלון (ברוטו לחודש, טווח) → מספר שנתי לבחירת טווח בטופס */
function salaryNums(t){const m=String(t||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*K/i);if(!m)return null;const lo=+m[1]*1000,hi=m[2]?+m[2]*1000:lo*1.2;
  const mid=/^עד/.test(t)?lo:Math.round((lo+hi)/2);return{monthly:mid,annual:mid*12}}
const KIT_FIELDS=[
  ['full','שם מלא',p=>cvFacts(p.cv).full_en||p.name||''],['first','שם פרטי',p=>cvFacts(p.cv).first_en||p.first||(p.name||'').split(' ')[0]||''],['last','שם משפחה',p=>cvFacts(p.cv).last_en||(p.name||'').split(' ').slice(1).join(' ')],
  ['email','מייל',p=>kitOf(p).email||((typeof ME!=='undefined'&&ME&&ME.email)||'')],['phone','טלפון',p=>kitOf(p).phone||''],
  ['city','עיר',p=>kitOf(p).city||''],['linkedin','LinkedIn',p=>(p.ans||{}).linkedin||''],
  ['github','GitHub',p=>{const g=((p.ans||{}).github||'').trim();return g?(g.startsWith('http')?g:'https://github.com/'+g.replace(/^@/,'')):''}],
  ['site','אתר / תיק עבודות',p=>kitOf(p).site||''],['edu','השכלה',p=>kitOf(p).edu||((f=>[[f.degree,f.discipline&&'in '+f.discipline].filter(Boolean).join(' '),f.school,f.edu_end].filter(Boolean).join(', '))(cvFacts(p.cv)))],
  ['salary','ציפיות שכר',p=>{const a=p.ans||{},n=salaryNums(a.salary);return n?`${n.monthly} ILS gross per month (${n.annual} per year)`:(a.salaryH||'')}],
  ['auth','אישור עבודה בישראל',p=>kitOf(p).auth||''],
  ['start','זמינות',p=>(p.ans||{}).start||''],
];
/* שדות מוסתרים: לא מוצגים ברשימת "חסר", רק עוזרים לסימנייה ולתשובות המוכנות */
function kitHidden(p){const f=cvFacts(p.cv),a=p.ans||{},n=salaryNums(a.salary);
  return {school:f.school||'',degree:f.degree||'',discipline:f.discipline||'',edu_start:f.edu_start||'',edu_end:f.edu_end||'',
    salary_annual:n?String(n.annual):'',bonus:kitOf(p).bonus||'0-4%',sponsor:'No',authorized:kitOf(p).auth==='אשרת עבודה'?'':'Yes',
    onsite:a.mode==='מהבית'?'No':'Yes',locs:(a.locs||[]).join(', '),country:'Israel',hear:'LinkedIn',
    english:{'שפת אם':'Native','שוטפת':'Fluent','טובה':'Very good','בסיסית':'Basic'}[a.english]||'',
    military:(a.army||[]).filter(x=>!/^לא/.test(x)).length?'Yes':''}}
function kitOf(p){return (p.ans||{}).kit||{}}
function kitData(){const p=prof(),o={};KIT_FIELDS.forEach(([k,,f])=>{const v=f(p);if(v&&!/עוד לא|לא בטוח/.test(v))o[k]=v});Object.entries(kitHidden(p)).forEach(([k,v])=>{if(v)o['h_'+k]=v});return o}

/* ערכת הגשה: 3 כרטיסים לפי הסדר של טופס אמיתי — קורות חיים (קובץ), מכתב, מילוי. כל כרטיס מראה קודם את המצב, והפרטים נפתחים במקום */
function kitTabHtml(a,j,id){track('kit_open');
  const p=prof(),d=kitData(),vis=KIT_FIELDS.filter(([k])=>!['first','last'].includes(k)),missing=vis.filter(([k])=>!d[k]);
  const letter=a.letter||(j.letter&&j.letter.text)||(REAL?'':letterFor(j)),t=j.tailor,ed=tailorEdits(j),off=new Set(((S.tailorOff||{})[a.jobId])||[]);
  const card=(title,chip,amb,body,acts)=>`<section class="kc"><div class="kc-h"><h4>${title}</h4>${chip?`<span class="kc-chip${amb?' amb':''}">${chip}</span>`:''}</div>${body}${acts?`<div class="kc-acts">${acts}</div>`:''}</section>`;
  const on=new Set(((S.tailorOn||{})[a.jobId])||[]);   // ברירת מחדל: לא מסומן. מסמנים מה נכנס ל-PDF
  const cvBody=!REAL||!t?`<p class="card-sub" style="margin:6px 0 0">${REAL?`${escB(N('linkedin'))} יציע התאמות למשרה הזו אחרי הריצה הקרובה. בינתיים: קורות החיים מהפרופיל.`:'קורות החיים מהפרופיל.'}</p>`
    :!ed.length?`<p class="card-sub" style="margin:6px 0 0">${t.no_ad?`אין מודעה מלאה, אז ${escB(N('linkedin'))} לא הציע שינויים.`:`${escB(N('linkedin'))} בדק: קורות החיים כבר מדגישים את מה שהמשרה מבקשת.`}</p>`
    :`<p class="card-sub" style="margin:6px 0 4px">${escB(N('linkedin'))} מציע ניסוח וסדר למשרה הזו, רק ממה שכבר כתוב אצלך. מה שתסמן ייכנס ל-PDF.</p>${t.order?`<p class="card-sub">↑ ${escB(t.order)}</p>`:''}
      ${ed.map((e,x)=>`<label class="kc-ed"><input type="checkbox" ${on.has(x)?'checked':''} onchange="tailorPick('${a.jobId}',${x},this.checked,'${id}')"><span dir="ltr"><s>${escB(e.before)}</s><b>${escB(e.after)}</b>${e.why?`<small dir="rtl">${escB(e.why)}</small>`:''}</span></label>`).join('')}`;
  const nOn=ed.filter((_,x)=>on.has(x)).length;
  return `<div class="kit">${a.status==='saved'?`<p class="kit-now">${escB(nowTxt(a))}</p>`:''}
    ${card('קורות חיים למשרה',ed.length?(nOn?`${nOn} מסומנות`:`${ed.length} התאמות מוצעות`):'',!!ed.length&&!nOn,cvBody,
      `<button class="btn btn-ghost btn-sm${ed.length&&!nOn?' is-off':''}" id="cvPdfBtn" onclick="${ed.length?`if(!((S.tailorOn||{})['${a.jobId}']||[]).length){toast('סמן לפחות התאמה אחת, והיא תיכנס ל-PDF');return}`:''}cvPreview('${a.jobId}','${id}')">${ed.length?'קובץ PDF למשרה':'PDF של קורות החיים'}</button>`)}
    ${card('מכתב פנייה',letter?`מוכן · ${letter.split(/\s+/).filter(Boolean).length} מילים`:'בהכנה',!letter,
      letter?`<p class="kc-pv" dir="ltr">${escB(letter.replace(/\s*\n+\s*/g,' ').slice(0,240))}</p>
        <details class="kc-det"><summary>לקרוא ולערוך</summary><label for="letterBox" class="vh">מכתב פנייה</label><textarea class="textbox letterbox ltr" dir="ltr" id="letterBox" rows="14" spellcheck="false" oninput="appOf('${id}').letter=this.value;save()">${esc(letter)}</textarea>
        ${j.letter&&!j.letter.checked?`<div class="hint-line">חלק מהמשפטים הוסרו כי לא הצלחנו לאמת אותם מול קורות החיים.</div>`:''}</details>`
      :`<p class="card-sub" style="margin:6px 0 0">${escB(N('assistant'))} מכין את המכתב. הוא יופיע כאן תוך שעתיים בערך.</p><textarea id="letterBox" hidden></textarea>`,
      letter?`<button class="btn btn-ghost btn-sm" onclick="copyText($('letterBox').value,'המכתב הועתק');track('letter_copy')">${ICO.copy}להעתיק</button>`:'')}
    ${card('מילוי הטופס',missing.length?`${vis.length-missing.length} מוכנים · ${missing.length} חסרים`:`${vis.length} פרטים מוכנים`,!!missing.length,
      `${missing.length?`<p class="card-sub" style="margin:6px 0 0">חסרים: ${escB(missing.map(m=>m[1]).join(', '))}. <button class="kc-more" onclick="openKitEdit()">להשלים</button></p>`:''}
       <details class="kc-det"><summary>תשובות מוכנות להעתקה</summary>${readyAnswersHtml()}</details>`,
      `<a class="btn btn-primary btn-sm ext" href="${j.url||LI_URL+'jobs/'}" target="_blank" rel="noopener" onclick="copyText($('letterBox').value,'המכתב הועתק. הדבק אותו בשדה המכתב בטופס');track('apply_open')">לפתוח את הטופס ולמלא</a>`)}
    <p class="card-sub" style="margin-top:10px">הסימנייה ממלאת את מה שהיא מזהה ומסמנת בצהוב מה לבדוק. היא לא שולחת. <button class="kc-more" onclick="openFillHelp()">איך מוסיפים אותה</button>${CLOUDM?` · שאלה בטופס? <button class="kc-more" onclick="askAboutJob('${a.jobId}');$('chatInput').value+='בטופס ההגשה שואלים: '">${escB(N('assistant'))} בצ׳אט</button>`:''}</p>
    <div class="s-sec">${appliedBox(a,true)}</div></div>`;
}
/* במשרה ששמרת: אותו פירוט התאמה כמו בהצעה (דרישות, למה מתאים, מה חסר), מקופל לשורה אחת */
function fitFold(j,jid){const d=j.dims||{},rq=Array.isArray(d.req)?d.req:[],met=rq.filter(r=>r[1]).length;
  const line=`${j.fit.toFixed(1)}/5${rq.length?` · ${met} מתוך ${rq.length} דרישות חובה`:''}${j.gaps.length?` · חסר: ${escB(String(j.gaps[0]).slice(0,40))}`:''}`;
  return `<details class="fit-fold"><summary><span class="ff-h">ההתאמה שלך</span><span class="ff-l">${line}</span></summary>
    ${dimsHtml(j)}
    ${j.reasons.length?`<div class="s-sec"><h4>למה זה מתאים לך</h4>${j.reasons.map(r=>`<div class="jc-r" style="margin-bottom:7px"><span class="ic ok" aria-hidden="true">✓</span><span>${escB(r)}</span></div>`).join('')}</div>`:''}
    ${j.gaps.length?`<div class="s-sec"><h4>מה חסר</h4>${j.gaps.map(g=>`<div class="jc-r" style="margin-bottom:7px"><span class="ic gap" aria-hidden="true">!</span><span>${escB(g)}</span></div>`).join('')}</div>`:''}
    <button class="kc-more" onclick="openJobInfo('${jid}')">המודעה המלאה ‹</button></details>`}
function tailorPick(jobId,x,v,appId){S.tailorOn=S.tailorOn||{};const L=new Set(S.tailorOn[jobId]||[]);v?L.add(x):L.delete(x);S.tailorOn[jobId]=[...L];save();paintAppTab(appId)}
function tailorToggle(jobId,x,on){S.tailorOff=S.tailorOff||{};const L=new Set(S.tailorOff[jobId]||[]);on?L.delete(x):L.add(x);S.tailorOff[jobId]=[...L];save()}
/* בלשונית הפרטים: רק קיצור. ההתאמות וה-PDF בערכת ההגשה */
function tailorLink(j,id){const n=((j.tailor||{}).edits||[]).length;if(!n)return'';
  return `<button class="row-link" onclick="openApp('${id}','letter')"><span>קורות חיים למשרה: ${n} התאמות של ${escB(N('linkedin'))}</span><span aria-hidden="true">‹</span></button>`}
/* PDF למשרה: קורות החיים עם ההתאמות שסומנו. נבנה בדפדפן (בלי שרת ובלי AI), ולכן מהיר: חלון הדפסה → "שמירה כ-PDF" */
function cvWithEdits(cv,edits){let out=String(cv||''),miss=0;for(const e of edits){if(e.before&&out.includes(e.before))out=out.replace(e.before,e.after);else miss++}return{text:out,miss}}
function cvHtml(text){const L=String(text).split('\n');let h='',ul=false;const close=()=>{if(ul){h+='</ul>';ul=false}};
  L.forEach((r,i)=>{const x=r.trim();if(!x){close();return}
    if(i===0||(!h&&x)){h+=`<h1>${escB(x)}</h1>`;return}
    if(/^[A-Z][A-Z &/]{3,}:?$/.test(x)||/^[א-ת ]{3,20}:$/.test(x)){close();h+=`<h2>${escB(x.replace(/:$/,''))}</h2>`;return}
    if(/^[-•*·]\s+/.test(x)){if(!ul){h+='<ul>';ul=true}h+=`<li>${escB(x.replace(/^[-•*·]\s+/,''))}</li>`;return}
    close();h+=`<p>${escB(x)}</p>`});close();return h}
/* התאמות שלא מוחקות כלום: גם הצעות ישנות (לפני הבדיקה בשרת) לא מוצגות אם נעלמו מהן כלים, מספרים או שמות */
function lostTerms(b,a){const first=new Set([...String(b).matchAll(/(?:^|[.:;•\-–]\s*)([A-Za-z]+)/g)].map(m=>m[1])),low=String(a).toLowerCase();
  return [...new Set((String(b).match(/[A-Za-z0-9][A-Za-z0-9+#./-]*/g)||[]).filter(w=>/[A-Z0-9]/.test(w)&&!first.has(w)).map(w=>w.replace(/[.,]+$/,'')))].filter(w=>w&&!low.includes(w.toLowerCase()))}
function tailorEdits(j){return (((j||{}).tailor||{}).edits||[]).filter(e=>!lostTerms(e.before,e.after).length)}
/* PDF למשרה: תצוגה מקדימה במקום (מיידית, בלי שרת ובלי AI), ואז "שמירה כ-PDF" מאותו מסך. בלי חלון או לשונית חדשה */
function cvPreview(jobId,appId){const j=JOBS[jobId]||{},on=new Set(((S.tailorOn||{})[jobId])||[]),ed=tailorEdits(j).filter((_,x)=>on.has(x));
  const {text,miss}=cvWithEdits(prof().cv,ed),rtl=/[֐-׿]/.test(text.slice(0,400));track('cv_pdf');
  window.__cvDoc={html:cvHtml(text),rtl,title:`${cvFacts(prof().cv).full_en||prof().name||'CV'} - CV - ${j.co||''}`.trim()};
  openSheet(`<h3 id="sheetTitle">קורות חיים ל-${escB(j.co||'')}</h3>
    <div class="sheet-sub">${ed.length?`עם ${ed.length} התאמות של ${escB(N('linkedin'))}`:'כמו בפרופיל'}${miss?` · ${miss} לא נכנסו כי הטקסט בקורות החיים השתנה`:''}</div>
    <div class="cv-page" dir="${rtl?'rtl':'ltr'}">${window.__cvDoc.html}</div>
    <div class="duo"><button class="btn btn-ghost" onclick="openApp('${appId}','letter')">חזרה</button><button class="btn btn-primary" onclick="cvPrint(this)">שמירה כ-PDF</button></div>
    <p class="card-sub" style="margin-top:8px">בחלון ההדפסה בוחרים "שמירה כ-PDF". הקובץ נשמר בשם ${escB(window.__cvDoc.title)}.</p>`)}
function cvPrint(btn){const d=window.__cvDoc;if(!d)return;btnBusy(btn,true);
  let r=$('printRoot');if(!r){r=document.createElement('div');r.id='printRoot';document.body.appendChild(r)}
  r.dir=d.rtl?'rtl':'ltr';r.innerHTML=d.html;const t0=document.title;document.title=d.title;   // שם הקובץ ב-PDF
  const done=()=>{document.title=t0;r.innerHTML='';btnBusy(btn,false);removeEventListener('afterprint',done)};addEventListener('afterprint',done);
  setTimeout(()=>{window.print();setTimeout(()=>{if(r.innerHTML)done()},1500)},50)}

/* תשובות מוכנות: לשאלות הנפוצות בטפסים ובהגשה המהירה של LinkedIn (באנגלית, כמו בטפסים). כל תשובה עם העתקה */
function readyAnswers(){const d=kitData(),h=k=>d['h_'+k]||'';
  return [['Full name',d.full],['Email',d.email],['Phone',d.phone],['LinkedIn',d.linkedin],['GitHub',d.github],['City',d.city&&d.city+', Israel'],
    ['Education',[[h('degree'),h('discipline')&&'in '+h('discipline')].filter(Boolean).join(' '),h('school'),(h('edu_start')||h('edu_end'))&&[h('edu_start'),h('edu_end')].filter(Boolean).join('–')].filter(Boolean).join(', ')],
    ['Legally authorized to work in Israel?',h('authorized')],['Require visa sponsorship?',h('sponsor')],['Comfortable working onsite / hybrid?',h('onsite')],
    ['Expected salary',d.salary],['Expected bonus',h('bonus')],['Start date / notice period',{'מיד':'Immediately','תוך חודש':'Within a month','בעוד 2–3 חודשים':'In 2-3 months','אחרי התואר':'After graduation'}[d.start]||''],
    ['English level',h('english')],['How did you hear about us?',h('hear')]].filter(x=>x[1])}
function readyAnswersHtml(){const L=readyAnswers();if(!L.length)return'<p class="card-sub">עוד אין פרטים. אפשר להשלים בפרופיל.</p>';
  return `<div class="ra">${L.map(([q,v],i)=>`<div class="ra-r"><span dir="ltr"><small lang="en">${escB(q)}</small><b dir="auto" id="ra${i}">${escB(v)}</b></span><button class="ra-c" aria-label="להעתיק" onclick="copyText($('ra${i}').textContent,'הועתק')">${ICO.copy}</button></div>`).join('')}</div>`}

function openKitEdit(){const k=kitOf(prof()),f=(id,l,v,ph,t)=>`<div class="field"><label for="${id}">${l}</label><input id="${id}" ${t?`type="${t}" class="ltr"`:''} value="${escB(v||'')}" placeholder="${ph}"></div>`;
  openSheet(`<h3 id="sheetTitle">פרטים לטפסי הגשה</h3><div class="sheet-sub">נשמרים רק אצלך, ומשמשים למילוי טפסים. שום דבר לא נשלח בלי שתלחץ בעצמך.</div>
    ${f('kEmail','מייל',k.email||((typeof ME!=='undefined'&&ME&&ME.email)||''),'name@gmail.com','email')}${f('kPhone','טלפון',k.phone,'050-0000000','tel')}
    ${f('kCity','עיר מגורים',k.city,'למשל: תל אביב')}${f('kSite','אתר או תיק עבודות',k.site,'https://','url')}
    ${f('kEdu','השכלה',k.edu,'למשל: B.Sc. Computer Science, HIT, 2026')}
    <div class="field"><label for="kAuth">אישור עבודה בישראל</label><select id="kAuth">${['','אזרח/ית ישראלי/ת','תושב/ת קבע','אשרת עבודה'].map(o=>`<option${o===(k.auth||'')?' selected':''}>${o}</option>`).join('')}</select></div>
    <div class="field"><label for="kBonus">ציפיות לבונוס שנתי</label><select id="kBonus">${['0-4%','5-9%','10-14%','15-19%'].map(o=>`<option${o===(k.bonus||'0-4%')?' selected':''}>${o}</option>`).join('')}</select></div>
    <p class="card-sub">שכר וזמינות נלקחים מהשאלון. השם באנגלית, ההשכלה והשנים נלקחים מקורות החיים.</p>
    <button class="btn btn-primary btn-block" onclick="saveKit()">שמירה</button>`)}
function saveKit(){track('profile_kit');const p=prof();p.ans=p.ans||{};p.ans.kit={email:$('kEmail').value.trim(),phone:$('kPhone').value.trim(),city:$('kCity').value.trim(),
  site:$('kSite').value.trim(),edu:$('kEdu').value.trim(),auth:$('kAuth').value,bonus:$('kBonus').value};save();closeSheet();if(curPg==='profile')renderProfile();toast('הפרטים נשמרו')}

/* הסימנייה: קוד שרץ בדף הטופס. הפרטים הקבועים בתוכה. המכתב נלקח מהלוח (אחרי "להעתיק את המכתב") */
function fillBookmarklet(){
  const D=JSON.stringify(kitData());
  const src=`(async()=>{const D=${D},H=k=>D['h_'+k]||'';
const R={first:/first.?name|given.?name|שם פרטי/i,last:/last.?name|family.?name|surname|שם משפחה/i,full:/full.?name|^name$|your name|שם מלא|^שם$/i,
email:/e-?mail|מייל|דוא.?ל/i,phone:/phone|mobile|\\btel\\b|טלפון|נייד/i,linkedin:/linkedin/i,github:/github/i,site:/website|portfolio|personal site|אתר|תיק עבודות/i,
country:/^country|\\bcountry\\b/i,city:/city|location|address|current location|עיר|מגורים/i,bonus:/bonus/i,salary:/salary|compensation|expected pay|שכר/i,start:/start date|notice|availability|available|זמינות|תחילת עבודה/i,
gradyear:/graduation|end year|year of graduation|שנת סיום/i,discipline:/discipline|field of study|major|תחום לימוד/i,school:/school|university|institution|college|מוסד/i,degree:/degree|education level|highest level|תואר/i,
auth:/authori[sz]ed|work permit|אישור עבודה/i,edu:/education|השכלה/i,letter:/cover.?letter|motivation|why .*(us|company)|מכתב|ספר.? על עצמך/i};
const V={country:H('country'),bonus:H('bonus'),gradyear:H('edu_end'),discipline:H('discipline'),school:H('school'),degree:H('degree')};
/* שאלות בחירה (רשימה, כן/לא, רשימה מדומה): איזו תשובה, ואם היא "בטוחה" (ירוק) או "לבדוק" (צהוב) */
const Q=[[/authori[sz]ed|legally|eligible to work|right to work|work permit/i,'auth',1],[/sponsor|visa/i,'sponsor',1],[/relocat/i,'',0],
[/on-?site|in the office|hybrid|commut/i,'onsite',1],[/local to|live in|located in|reside|based in/i,'local',0],[/bonus/i,'bonus',0],[/salary|compensation|expected pay/i,'salary',0],
[/discipline|field of study|major/i,'discipline',0],[/school|university|institution/i,'school',0],[/degree|education level|highest level/i,'degree',1],
[/hear about|how did you (find|hear)|referral source|^source/i,'hear',1],[/gender|race|ethnic|veteran|disabilit|hispanic|pronoun|sexual orientation/i,'eeo',1]];
const nums=t=>(String(t).replace(/,/g,'').match(/\\d+(\\.\\d+)?/g)||[]).map(Number);
const inRange=(t,n)=>{const v=nums(t);if(!v.length)return false;const lo=Math.min(...v),hi=Math.max(...v);if(/under|below|less than|עד/i.test(t))return n<=hi;if(/above|over|more than|\\+|ומעלה/i.test(t))return n>=lo;return v.length>1?n>=lo&&n<=hi:n===lo};
const pick=(kind,opts,q)=>{const f=rx=>opts.findIndex(o=>rx.test(o));
 if(kind==='auth')return H('authorized')==='Yes'?f(/^\\s*yes\\b/i):-1;if(kind==='sponsor')return f(/^\\s*no\\b/i);
 if(kind==='onsite')return f(H('onsite')==='Yes'?/^\\s*yes\\b/i:/^\\s*no\\b/i);
 if(kind==='local'){const c=(D.city||'')+','+H('locs');const city=(q.match(/to ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/)||[])[1]||'';return city&&/tel aviv/i.test(city)&&/תל אביב|גוש דן|tel aviv/i.test(c)?f(/^\\s*yes\\b/i):-1}
 if(kind==='salary'){const a=+H('salary_annual');if(!a)return -1;const big=opts.some(o=>nums(o).some(x=>x>=100000));return opts.findIndex(o=>inRange(o,big?a:Math.round(a/12)))}
 if(kind==='bonus'){const b=nums(H('bonus'))[0];return b==null?-1:opts.findIndex(o=>/%/.test(o)&&inRange(o,b))}
 if(kind==='degree'){const w=(H('degree').match(/bachelor|master|doctor|practical/i)||[])[0];return w?f(new RegExp(w,'i')):-1}
 if(kind==='school'){const v=H('school');if(!v)return -1;const i=opts.findIndex(o=>o.toLowerCase().includes(v.toLowerCase().replace(/^the /,'')));return i>=0?i:f(/^\\s*other\\b/i)}
 if(kind==='discipline'){const v=H('discipline');return v?f(new RegExp(v.replace(/[^a-z ]/gi,''),'i')):-1}
 if(kind==='hear')return f(/linkedin/i);if(kind==='eeo')return f(/decline|prefer not|don.?t wish|not to (say|disclose)|i don.?t want/i);return -1};
const tx=n=>(n.innerText||n.textContent||'').trim();const lab=e=>{let t=[];if(e.id){const l=document.querySelector('label[for="'+CSS.escape(e.id)+'"]');if(l)t.push(tx(l))}const pl=e.closest('label');if(pl&&e.type!=='radio'&&e.type!=='checkbox')t.push(tx(pl));
t.push(e.getAttribute('aria-label')||'',e.placeholder||'',e.name||'',e.id||'');const w=e.closest('fieldset,[class*=field],[class*=question],[data-automation-id]');if(w&&(!t[0]||e.type==='radio'))t.unshift(tx(w.querySelector('legend,label,[class*=label]')||w).slice(0,160));return t.join(' | ')};
const set=(e,v)=>{const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};
const mark=(e,c)=>{e.style.outline='3px solid '+c;e.style.outlineOffset='2px'};const G='#3E8A66',Y='#E9A825';
/* בחירה באפשרות (רדיו / אפשרות ברשימה מדומה) בלבד. לעולם לא כפתור, קישור או שליחה */
const tap=el=>{if(!el||el.closest('button,a,[type=submit],form>[type=button]')&&!el.matches('[role=option]'))return;if(el.type==='radio'){el.checked=true;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}el.dispatchEvent(new MouseEvent('click',{bubbles:true}))};
const kindOf=L=>Q.find(q=>q[0].test(L));
let clip='';try{clip=await navigator.clipboard.readText()}catch(x){}
let n=0,y=0;const radios=new Set();
for(const e of document.querySelectorAll('input,textarea,select')){if(e.disabled||e.type==='hidden'||e.type==='submit'||e.type==='button'||e.offsetParent===null)continue;
if(e.type==='file'){mark(e,Y);y++;continue}
if(e.tagName==='SELECT'){if(e.selectedIndex>0)continue;const L=lab(e),q=kindOf(L),o=[...e.options].map(x=>x.text);const i=q&&q[1]?pick(q[1],o,L):-1;
 if(i>0){e.selectedIndex=i;e.dispatchEvent(new Event('change',{bubbles:true}));mark(e,q[2]?G:Y);n++;if(!q[2])y++}else if(e.required||e.getAttribute('aria-required')==='true'||q){mark(e,Y);y++}continue}
if(e.type==='radio'){if(!e.name||radios.has(e.name))continue;radios.add(e.name);const g=[...document.querySelectorAll('input[type=radio][name="'+CSS.escape(e.name)+'"]')];if(g.some(r=>r.checked))continue;
 const L=lab(e),q=kindOf(L),o=g.map(r=>{const l=r.id&&document.querySelector('label[for="'+CSS.escape(r.id)+'"]');return tx(l||r.closest('label')||r.parentElement)});const i=q&&q[1]?pick(q[1],o,L):-1;
 if(i>=0){tap(g[i]);mark(g[i].closest('label')||g[i],q[2]?G:Y);n++;if(!q[2])y++}else{mark(e.closest('fieldset')||e.parentElement,Y);y++}continue}
if(e.type==='checkbox'){if(e.required||e.getAttribute('aria-required')==='true'){mark(e,Y);y++}continue}
if(e.value&&e.value.trim())continue;const L=lab(e);let k=Object.keys(R).find(k=>R[k].test(L));
if(k==='full'&&(R.first.test(L)||R.last.test(L)))k=R.first.test(L)?'first':'last';
let v=k==='letter'?(clip.length>200?clip:''):(V[k]!==undefined?V[k]:D[k]);
if(k&&v){set(e,v);const combo=e.getAttribute('role')==='combobox'||e.getAttribute('aria-autocomplete');
 if(combo){await new Promise(r=>setTimeout(r,450));const op=[...document.querySelectorAll('[role=option]')].find(o=>tx(o).toLowerCase().includes(String(v).toLowerCase().slice(0,12)));if(op)tap(op)}
 const sure=!combo&&!['letter','city','salary','start','bonus','school','discipline'].includes(k);mark(e,sure?G:Y);n++;if(!sure)y++}
else if(e.required||e.getAttribute('aria-required')==='true'){mark(e,Y);y++}}
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
