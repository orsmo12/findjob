/* ═════════ CLOUD — חיבור ל-Supabase (רק בגרסה המאוחסנת) ═════════
   התחברות בקישור למייל. הפרופיל, קורות החיים והשאלון נשמרים בענן, והסוכנים קוראים אותם משם בלילה.
   המשרות שדורון מצא נטענות מהענן. כל משתמש רואה רק את הנתונים שלו (RLS). */
let SB=null,ME=null,LI={},RUNS=[],CHAT=[],_profSnap='',_decSnap={},_syncT=null;
function cloudLogin(msg){
  const o=$('onb');o.classList.add('open');o.classList.remove('qmode');
  $('onbSteps').innerHTML='';$('onbBack').style.visibility='hidden';
  $('onbBody').innerHTML=`<div class="logo-mark" style="margin-bottom:22px"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.8l1.8 1.8L13.3 9"/></svg></div>
    <h1>כניסה ל-findjob</h1><p class="lead">נשלח לך קישור כניסה למייל. בלי סיסמה.</p>
    <div class="field"><label for="loginEmail">המייל שלך</label><input id="loginEmail" class="ltr" type="email" autocomplete="email" inputmode="email" placeholder="name@gmail.com" onkeydown="if(event.key==='Enter')cloudSend()">
    <div class="help" id="loginHelp">${msg||''}</div></div>`;
  $('onbFoot').innerHTML=`<button class="btn btn-primary btn-block" id="loginBtn" onclick="cloudSend()">שלחו לי קישור</button>`;
  setTimeout(()=>$('splash').classList.add('hide'),400);
}
async function cloudSend(){
  const em=($('loginEmail').value||'').trim(),h=$('loginHelp');
  if(!/^\S+@\S+\.\S+$/.test(em)){h.textContent='צריך כתובת מייל תקינה';h.style.color='var(--rose)';return}
  $('loginBtn').disabled=true;
  const {error}=await SB.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname}});
  $('loginBtn').disabled=false;
  if(error){h.textContent='לא הצלחתי לשלוח: '+error.message;h.style.color='var(--rose)';return}
  h.style.color='var(--brand)';h.textContent='נשלח. פתח את המייל באותו מכשיר ולחץ על הקישור.';
}
async function cloudLoad(){
  const uid=ME.id;
  const [{data:pr},{data:jobs},{data:runs}]=await Promise.all([
    SB.from('profiles').select('*').eq('user_id',uid).maybeSingle(),
    SB.from('jobs').select('id,card,decision,letter,brief,prep,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(200),
    SB.from('runs').select('agent,stats,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(150)]);
  if(pr){const p=prof();p.first=pr.first||p.first;p.name=pr.name||p.name;p.cv=pr.cv_text||p.cv;p.ans=Object.assign({},pr.answers||{},p.ans||{});
    if(pr.team&&Object.keys(pr.team).length)S.team=pr.team;const st=pr.state||{};['apps','todos','stories'].forEach(k=>{if(Array.isArray(st[k]))S[k]=st[k]});if(st.targets)S.targets=st.targets;if(Array.isArray(st.history))S.history=st.history;if(Array.isArray(st.chat))S.chat=st.chat;p.li_text=pr.li_text||'';LI=Object.assign({},pr.li||{},{fixes:((pr.li_fixes||{}).fixes)||[]});if(pr.cv_text)S.onboarded=true}
  prof().key='cloud';
  RUNS=runs||[];const hr=RUNS.filter(r=>(r.agent||'hunter')==='hunter');
  if(hr.length||(jobs&&jobs.length)){
    const live=(jobs||[]).filter(r=>r.decision!=='filtered'&&(r.decision!=='skip'||S.decisions[r.id]));
    setFeed({generated_at:hr.length?hr[0].created_at:null,stats:hr.length?(hr[0].stats||{}):{},jobs:live.map(r=>Object.assign({},r.card,{letter:r.letter||null,brief:r.brief||null,prep:r.prep||null,closed_at:(r.card&&r.card.closed_at)||null})).sort((a,b)=>b.fit-a.fit)});
    (jobs||[]).forEach(r=>{if(r.decision&&r.decision!=='filtered')S.decisions[r.id]=r.decision});
  }
  S.apps=(S.apps||[]).filter(a=>JOBS[a.jobId]);
  closedToHistory();
  _decSnap=Object.assign({},S.decisions);_profSnap=profRow();
  LS.set(SKEY,S);window.__runsReady=true;if(typeof applyTeam==='function')applyTeam();buildWorkflow();
}
function profRow(){const p=prof();return JSON.stringify({first:p.first||'',name:p.name||'',cv_text:p.cv||'',answers:p.ans||{},team:S.team||{},state:{apps:S.apps,todos:S.todos,stories:S.stories,targets:S.targets||{added:[],removed:[]},history:S.history||[],chat:(S.chat||[]).slice(-40)},li_text:p.li_text||''})}
function cloudSync(){clearTimeout(_syncT);_syncT=setTimeout(async()=>{
  if(!ME)return;
  const row=profRow();
  if(row!==_profSnap){const r=JSON.parse(row);r.user_id=ME.id;r.updated_at=new Date().toISOString();
    const {error}=await SB.from('profiles').upsert(r);if(!error)_profSnap=row;else toast('לא הצלחתי לשמור בענן. אנסה שוב');}
  const ids=new Set([...Object.keys(_decSnap),...Object.keys(S.decisions)]);
  for(const id of ids){const v=S.decisions[id]||null;if((_decSnap[id]||null)===v||!JOBS[id])continue;
    const {error}=await SB.from('jobs').update({decision:v}).eq('user_id',ME.id).eq('id',id);if(!error){if(v)_decSnap[id]=v;else delete _decSnap[id]}}
},700)}
async function cloudBoot(){
  SB=supabase.createClient(CLOUD.url,CLOUD.key,{auth:{persistSession:true,detectSessionInUrl:true,flowType:'implicit'}});
  const {data:{session}}=await SB.auth.getSession();
  if(!session){cloudLogin();SB.auth.onAuthStateChange((ev,s)=>{if(s&&!ME)location.reload()});return}
  ME=session.user;
  try{await cloudLoad()}catch(e){console.warn(e);toast('אין חיבור לענן כרגע. מוצג מה ששמור במכשיר')}
  closeOnb();init();
}
function cloudLogout(){SB.auth.signOut().then(()=>{LS.clear();location.reload()})}

/* צ׳אט עם שי: רואה את כל הנתונים שלך, זוכר את השיחה, ויכול להציע פעולה — שמתבצעת רק באישור שלך */
let chatFocus='';
async function cloudChat(v){
  S.chat=S.chat||[];S.chat.push({role:'user',content:v});
  const typing=document.createElement('div');typing.className='msg bot typing';typing.innerHTML='<i></i><i></i><i></i>';$('chatMsgs').appendChild(typing);$('chatMsgs').scrollTop=1e6;
  let d={};
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:S.chat.slice(-14),token:session&&session.access_token,focus:chatFocus})});
    d=await r.json().catch(()=>({}));
    if(!d.reply)d.reply=d.error==='no_key'?'הצ׳אט עוד לא מחובר לשרת.':r.status===401?'צריך להתחבר מחדש.':'יש עומס כרגע. נסה שוב בעוד דקה.';
  }catch(e){d={reply:'אין חיבור כרגע. נסה שוב.'}}
  typing.remove();
  S.chat.push({role:'assistant',content:d.reply,action:d.action||null});S.chat=S.chat.slice(-40);save();
  addBotMsg(d.reply,d.action,S.chat.length-1);chatSugs();
}
function mdLite(t){return escB(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^- (.+)$/gm,'<span class="li">• $1</span>')}
function addBotMsg(text,action,idx){
  const d=document.createElement('div');d.className='msg bot';d.innerHTML=mdLite(text);$('chatMsgs').appendChild(d);
  if(action){const c=actionCard(action,idx);if(c)$('chatMsgs').appendChild(c)}
  $('chatMsgs').scrollTop=1e6;
}
const ST_HE={saved:'שמור',applied:'הוגש',screening:'סינון',interview:'ראיון',offer:'הצעה',rejected:'נדחה',ghosted:'אין מענה',withdrew:'ויתרתי'};
function actionText(x){const j=x.job_id&&JOBS[x.job_id],n=j?`${j.title} ב-${j.co}`:'';
  return{set_status:`לעדכן את ${n} ל"${ST_HE[x.status]||x.status}"${x.iv?` (${x.iv})`:''}`,add_note:`להוסיף הערה ל-${n}: "${x.text}"`,
    set_letter:`להחליף את מכתב הפנייה ל-${n} בגרסה החדשה`,add_job:`להוסיף משרה מהקישור`,save_job:`לשמור את ${n} ולהעביר להגשות`,
    skip_job:`לדלג על ${n}`,remove_app:`להסיר את ${n} מההגשות`,add_todo:`להוסיף משימה: "${x.text}"`,add_story:`להוסיף לבנק הסיפורים: "${x.title}"`}[x.type]}
function actionCard(x,idx){
  const txt=actionText(x);if(!txt)return null;const h=S.chat[idx]||{};
  const el=document.createElement('div');el.className='act-card';
  el.innerHTML=h.done?`<span>✓ ${escB(txt)}</span>`:h.declined?`<span class="muted">בוטל: ${escB(txt)}</span>`:
    `<span>${escB(txt)}?</span><div class="duo"><button class="btn btn-sm btn-ghost">ביטול</button><button class="btn btn-sm btn-primary">אישור</button></div>`;
  const [no,yes]=el.querySelectorAll('button');
  if(yes)yes.onclick=async()=>{const ok=await runAction(x);if(ok!==false){h.done=true;save();el.innerHTML=`<span>✓ ${escB(txt)}</span>`}};
  if(no)no.onclick=()=>{h.declined=true;save();el.innerHTML=`<span class="muted">בוטל: ${escB(txt)}</span>`};
  return el;
}
async function runAction(x){
  const app=x.job_id&&S.apps.find(a=>a.jobId===x.job_id);
  const needApp=()=>{if(!app){toast('המשרה לא נמצאת בהגשות');return false}return true};
  switch(x.type){
    case 'set_status':if(!needApp()||!ST_HE[x.status])return false;app.status=x.status;if(x.iv)app.iv=x.iv;if(x.status==='applied')app.date=new Date().toISOString();break;
    case 'add_note':if(!needApp())return false;app.note=((app.note||'')+'\n'+x.text).trim();break;
    case 'set_letter':if(!needApp())return false;app.letter=x.text;break;
    case 'save_job':if(!JOBS[x.job_id])return false;S.decisions[x.job_id]='save';if(!app)S.apps.unshift({id:'a-'+x.job_id,jobId:x.job_id,status:'saved',date:new Date().toISOString(),letter:''});break;
    case 'skip_job':S.decisions[x.job_id]='skip';break;
    case 'remove_app':if(!needApp())return false;removeApp(app.id);return true;
    case 'add_todo':S.todos.unshift({id:'t'+Date.now(),text:x.text,done:false});break;
    case 'add_story':S.stories.push({id:'s'+Date.now(),t:x.title,b:x.body||''});break;
    case 'add_job':toggleChat();openAddJob();setTimeout(()=>{const i=$('ajUrl');if(i)i.value=x.url||''},250);return true;
    default:return false;
  }
  save();refreshApps();toast('בוצע');return true;
}
function chatSugs(){
  const iv=S.apps.find(a=>a.status==='interview'),sv=S.apps.find(a=>a.status==='saved'),q=queue();
  const s=[iv&&`תתרגל איתי ראיון ל-${JOBS[iv.jobId].co}`,q.length&&'איזו משרה חדשה הכי מתאימה לי?',sv&&`איך לשפר את המכתב ל-${JOBS[sv.jobId].co}?`,'מה הכי חשוב לעשות היום?'].filter(Boolean).slice(0,3);
  $('chatSugs').innerHTML=s.map(t=>`<button onclick="chatAsk(this.textContent)">${escB(t)}</button>`).join('');
}
function renderChatHistory(){
  const box=$('chatMsgs');if(box.dataset.loaded)return;box.dataset.loaded='1';box.innerHTML='';
  (S.chat||[]).slice(-20).forEach((m,i,arr)=>{const idx=(S.chat.length-arr.length)+i;if(m.role==='user')addMsg('me',m.content);else addBotMsg(m.content,m.action,idx)});
}
function newChat(){S.chat=[];chatFocus='';save();const b=$('chatMsgs');b.innerHTML='';addMsg('bot',`שיחה חדשה. במה לעזור, ${prof().first||''}?`);chatSugs()}
function askAboutJob(jobId){chatFocus=jobId;closeSheet();toggleChat(true);const j=JOBS[jobId];$('chatInput').value=`לגבי ${j.title} ב-${j.co}: `;$('chatInput').focus()}

/* הודעות המשרד: מה הסוכנים עשו בפועל */
function realUpdates(){
  const seat=k=>{const i=CAREER.agents.findIndex(a=>a.key===k);return i<0?0:i};
  const ago=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<60?`לפני ${Math.max(1,m)} דק׳`:m<1440?`לפני ${Math.round(m/60)===1?'שעה':Math.round(m/60)+' שעות'}`:m<2880?'אתמול':new Date(t).toLocaleDateString('he-IL')};
  return RUNS.filter(r=>r.stats&&r.stats.msg).map(r=>({a:seat(r.agent||'hunter'),time:ago(r.created_at),body:r.stats.msg}));
}

/* הוספת משרה מקישור: נכנסת לתהליך כמו משרה ששמרת */
function openAddJob(){
  openSheet(`<h3 id="sheetTitle">הוספת משרה מקישור</h3>
    <p class="sheet-sub" style="margin-bottom:12px">מצאת משרה בעצמך? הדבק את הקישור. ${escB(N('hunter'))} ידרג אותה מול קורות החיים שלך, והיא תיכנס להגשות: ${escB(N('assistant'))} יכין מכתב, ${escB(N('researcher'))} סקירה ו${escB(N('coach'))} שאלות הכנה.</p>
    <div class="field"><label for="ajUrl">קישור למשרה</label><input id="ajUrl" class="ltr" type="url" inputmode="url" placeholder="https://www.linkedin.com/jobs/view/…" autocomplete="off"></div>
    <div class="field" id="ajTextWrap" hidden><label for="ajText">תיאור המשרה</label><textarea id="ajText" class="textbox" rows="7" placeholder="האתר לא נתן לקרוא את המשרה. העתק לכאן את כל הטקסט שלה."></textarea></div>
    <div class="help" id="ajHelp"></div>
    <button class="btn btn-primary btn-block" id="ajBtn" style="margin-top:12px" onclick="submitAddJob()">הוספה</button>`);
  setTimeout(()=>{const i=$('ajUrl');i&&i.focus();navigator.clipboard&&navigator.clipboard.readText&&navigator.clipboard.readText().then(t=>{if(/^https?:\/\//.test(t||'')&&i&&!i.value)i.value=t.trim()}).catch(()=>{})},200);
}
async function submitAddJob(){
  const url=($('ajUrl').value||'').trim(),text=($('ajText').value||'').trim(),h=$('ajHelp'),btn=$('ajBtn');
  if(!/^https?:\/\//.test(url)&&text.length<200){h.textContent='צריך קישור שמתחיל ב-https://';h.style.color='var(--rose)';return}
  btn.disabled=true;btn.textContent=`${N('hunter')} קורא את המשרה…`;h.textContent='';
  let d={};
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/addjob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,text,token:session&&session.access_token})});
    d=await r.json().catch(()=>({}));if(!r.ok&&!d.error)d.error='http'}catch(e){d={error:'net'}}
  btn.disabled=false;btn.textContent='הוספה';
  if(d.need_text){$('ajTextWrap').hidden=false;h.style.color='var(--ink2)';h.textContent='האתר לא מאפשר לקרוא את המשרה ישירות. העתק לשדה את התיאור שלה, ולחץ שוב על "הוספה".';$('ajText').focus();return}
  if(d.not_job){h.style.color='var(--rose)';h.textContent='זה לא נראה כמו מודעת משרה. בדוק את הקישור.';return}
  if(!d.card){h.style.color='var(--rose)';h.textContent=d.error==='auth'?'צריך להתחבר מחדש.':'משהו השתבש. נסה שוב בעוד דקה.';return}
  const c=Object.assign({},d.card,{letter:null,brief:null,prep:null});
  JOBS[c.id]=fromFeed({jobs:[c]})[c.id];if(!DECK.includes(c.id))DECK.push(c.id);
  S.decisions[c.id]='save';_decSnap[c.id]='save';
  if(!S.apps.find(a=>a.jobId===c.id))S.apps.unshift({id:'a-'+c.id,jobId:c.id,status:'saved',date:new Date().toISOString(),letter:''});
  save();closeSheet();
  toast(`${c.title} ב-${c.co}: התאמה ${c.fit} מתוך 5. נכנסה להגשות.${c.seniority_ok===false?' שים לב: היא דורשת יותר ניסיון.':''}`,{ms:5200});
  goPage('apps');setTimeout(()=>openApp('a-'+c.id,'details'),250);
}

/* משרה שנסגרה: אם עוד לא הגשת — יוצאת מההגשות להיסטוריה. אם כבר הגשת — נשארת, עם סימון */
function closedToHistory(){
  S.history=S.history||[];const moved=[];
  S.apps=S.apps.filter(a=>{const j=JOBS[a.jobId];if(a.status==='saved'&&j&&j.closed_at){
    S.history.unshift({jobId:a.jobId,co:j.co,title:j.title,url:j.url,reason:'closed',date:j.closed_at});moved.push(j);return false}return true});
  if(moved.length)setTimeout(()=>toast(moved.length===1?`${moved[0].title} ב-${moved[0].co} נסגרה למועמדים. העברתי להיסטוריה.`:`${moved.length} משרות ששמרת נסגרו. העברתי להיסטוריה.`,{ms:5200}),1600);
}
/* מטלה אחרת: קודם מהמאגר שמאיה כבר הכינה, ואם נגמר — בקשה למטלות נוספות */
async function requestMoreTasks(jobId){
  const j=JOBS[jobId];if(!j||!j.prep)return;
  j.prep=Object.assign({},j.prep,{more_tasks:true});
  const {error}=await SB.from('jobs').update({prep:j.prep}).eq('user_id',ME.id).eq('id',jobId);
  toast(error?'לא הצלחתי לבקש. נסה שוב':`${N('coach')} תביא מטלות נוספות תוך שעתיים בערך`);renderPrep();
}
