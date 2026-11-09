/* ═════════ CLOUD — חיבור ל-Supabase (רק בגרסה המאוחסנת) ═════════
   התחברות עם Google (או קישור למייל, שעובד רק לחברי הצוות ב-Supabase). הפרופיל, קורות החיים והשאלון נשמרים בענן, והסוכנים קוראים אותם משם בלילה.
   המשרות שדורון מצא נטענות מהענן. כל משתמש רואה רק את הנתונים שלו (RLS). */
let SB=null,ME=null,LI={},RUNS=[],CHAT=[],_profSnap='',_decSnap={},_syncT=null;
function cloudLogin(msg){
  const o=$('onb');o.classList.add('open');o.classList.remove('qmode');
  $('onbSteps').innerHTML='';$('onbBack').style.visibility='hidden';
  $('onbBody').innerHTML=`<div class="logo-mark" style="margin-bottom:22px"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.8l1.8 1.8L13.3 9"/></svg></div>
    <h1>כניסה ל-findjob</h1><p class="lead">נכנסים עם חשבון Google. findjob מקבל רק שם ומייל, בלי גישה למייל, ליומן או לקבצים.</p>
    <div class="help" id="loginHelp" style="margin-bottom:14px">${msg||''}</div>
    <details class="login-mail"><summary>כניסה עם קישור למייל</summary>
    <div class="field" style="margin-top:12px"><label for="loginEmail">המייל שלך</label><input id="loginEmail" class="ltr" type="email" autocomplete="email" inputmode="email" placeholder="name@gmail.com" onkeydown="if(event.key==='Enter')cloudSend()">
    <div class="help" id="mailHelp"></div></div>
    <button class="btn btn-ghost btn-block" id="loginBtn" onclick="cloudSend()">שלחו לי קישור</button></details>`;
  $('onbFoot').innerHTML=`<button class="btn btn-primary btn-block" id="googleBtn" onclick="cloudGoogle()"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-inline-end:8px;vertical-align:-3px;background:#fff;border-radius:50%;padding:1px"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>המשך עם Google</button>`;
  setTimeout(()=>$('splash').classList.add('hide'),400);
}
async function cloudGoogle(){
  const b=$('googleBtn'),h=$('loginHelp');b.disabled=true;
  const {error}=await SB.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:'select_account'}}});
  if(error){b.disabled=false;h.textContent='הכניסה עם Google לא הצליחה: '+error.message;h.style.color='var(--rose)'}
}
function authErr(){const q=new URLSearchParams((location.hash||'').slice(1)+'&'+(location.search||'').slice(1));
  const e=q.get('error_description')||q.get('error');if(!e)return '';
  history.replaceState(null,'',location.pathname);return 'הכניסה לא הושלמה ('+e.replace(/\+/g,' ')+'). נסה שוב.'}
async function cloudSend(){
  const em=($('loginEmail').value||'').trim(),h=$('mailHelp');
  if(!/^\S+@\S+\.\S+$/.test(em)){h.textContent='צריך כתובת מייל תקינה';h.style.color='var(--rose)';return}
  $('loginBtn').disabled=true;
  const {error}=await SB.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname}});
  $('loginBtn').disabled=false;
  if(error){h.textContent='לא הצלחתי לשלוח: '+error.message;h.style.color='var(--rose)';return}
  h.style.color='var(--brand)';h.textContent='נשלח. פתח את המייל באותו מכשיר ולחץ על הקישור.';
}
/* משרות מהענן. אם עמודת tailor עוד לא קיימת (לא הורץ supabase/agent_tasks.sql) — טוענים בלעדיה */
async function loadJobs(uid,cols='id,card,decision,letter,brief,prep,tailor,created_at'){
  const r=await SB.from('jobs').select(cols).eq('user_id',uid).or('decision.is.null,decision.neq.filtered').order('created_at',{ascending:false}).limit(200);
  return r.error&&cols.includes('tailor')?loadJobs(uid,cols.replace(',tailor','')):r;
}
async function cloudLoad(){
  const uid=ME.id;
  const [{data:pr},{data:jobs},{data:runs}]=await Promise.all([
    SB.from('profiles').select('*').eq('user_id',uid).maybeSingle(),
    loadJobs(uid),
    SB.from('runs').select('agent,stats,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(150)]);
  if(pr){const p=prof();p.first=pr.first||p.first;p.name=pr.name||p.name;p.cv=pr.cv_text||p.cv;p.ans=Object.assign({},pr.answers||{},p.ans||{});
    if(pr.team&&Object.keys(pr.team).length)S.team=pr.team;const st=pr.state||{};['apps','todos','stories'].forEach(k=>{if(Array.isArray(st[k]))S[k]=st[k]});if(st.targets)S.targets=st.targets;if(Array.isArray(st.history))S.history=st.history;if(Array.isArray(st.chat))S.chat=st.chat;if(Array.isArray(st.accepted))S.accepted=st.accepted;if(Array.isArray(st.dismissed))S.dismissed=st.dismissed;if(Array.isArray(st.cvDone))S.cvDone=st.cvDone;if(st.usage)S.usage=st.usage;if(st.ai_key)S.ai_key=st.ai_key;if(Array.isArray(st.feedback))S.feedback=st.feedback;p.li_text=pr.li_text||'';LI=Object.assign({},pr.li||{},{fixes:((pr.li_fixes||{}).fixes)||[]});if(pr.cv_text)S.onboarded=true}
  prof().key='cloud';
  RUNS=runs||[];const hr=RUNS.filter(r=>(r.agent||'hunter')==='hunter');
  if(hr.length||(jobs&&jobs.length)){
    const live=(jobs||[]).filter(r=>r.decision!=='filtered'&&(r.decision!=='skip'||S.decisions[r.id]));
    setFeed({generated_at:hr.length?hr[0].created_at:null,stats:hr.length?(hr[0].stats||{}):{},jobs:live.map(r=>Object.assign({},r.card,{letter:r.letter||null,brief:r.brief||null,prep:r.prep||null,tailor:r.tailor||null,closed_at:(r.card&&r.card.closed_at)||null})).sort((a,b)=>b.fit-a.fit)});
    (jobs||[]).forEach(r=>{if(r.decision&&r.decision!=='filtered')S.decisions[r.id]=r.decision});
  }
  S.apps=(S.apps||[]).filter(a=>JOBS[a.jobId]);
  closedToHistory();
  _decSnap=Object.assign({},S.decisions);_profSnap=profRow();
  LS.set(SKEY,S);window.__runsReady=true;if(typeof applyTeam==='function')applyTeam();buildWorkflow();
}
function profRow(){const p=prof();return JSON.stringify({first:p.first||'',name:p.name||'',cv_text:p.cv||'',answers:p.ans||{},team:S.team||{},state:{apps:S.apps,todos:S.todos,stories:S.stories,targets:S.targets||{added:[],removed:[]},history:S.history||[],chat:(S.chat||[]).slice(-40),accepted:S.accepted||[],dismissed:S.dismissed||[],cvDone:S.cvDone||[],usage:S.usage||{},ai_key:S.ai_key||'',feedback:(S.feedback||[]).slice(-30)},li_text:p.li_text||''})}
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
  if(!session){cloudLogin(authErr());SB.auth.onAuthStateChange((ev,s)=>{if(s&&!ME)location.reload()});return}
  ME=session.user;
  try{await cloudLoad()}catch(e){console.warn(e);toast('אין חיבור לענן כרגע. מוצג מה ששמור במכשיר')}
  {const md=ME.user_metadata||{},p=prof(),full=(md.full_name||md.name||'').trim();
   if(full&&!p.name)p.name=full;if(full&&!p.first)p.first=full.split(/\s+/)[0];}
  closeOnb();init();
}
function cloudLogout(){SB.auth.signOut().then(()=>{LS.clear();location.reload()})}

/* צ׳אט עם שי: רואה את כל הנתונים שלך, זוכר את השיחה, ויכול להציע פעולה — שמתבצעת רק באישור שלך */
let chatFocus='';
async function cloudChat(v){
  track('chat');
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
    skip_job:`לדלג על ${n}`,remove_app:`להסיר את ${n} מההגשות`,add_todo:`להוסיף משימה: "${x.text}"`,add_story:`להוסיף לבנק הסיפורים: "${x.title}"`,feedback:`לשלוח למפתח את הבקשה: "${x.text}"`}[x.type]}
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
    case 'feedback':S.feedback=S.feedback||[];S.feedback.push({t:String(x.text||'').slice(0,1000),at:new Date().toISOString(),page:'chat'});track('feedback');break;
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
  return RUNS.filter(r=>r.stats&&r.stats.msg).map(r=>({a:seat(r.agent||'hunter'),time:ago(r.created_at),body:r.stats.msg,report:!!r.stats.report,usage:!!r.stats.usage_report}));
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
async function submitAddJob(){track('add_job');
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

/* הישיבה השבועית של הצוות: דוח מצב, מה שונה, והצעות לאישור */
function lastMeeting(){return (typeof RUNS!=='undefined'&&RUNS||[]).find(r=>r.agent==='strategist'&&r.stats&&r.stats.report)||null}
function pendingSuggestions(){const m=lastMeeting();if(!m)return[];const acc=new Set((S.accepted||[]).map(x=>x.value.toLowerCase())),dis=new Set((S.dismissed||[]).map(x=>x.toLowerCase()));
  return (m.stats.report.suggestions||[]).filter(s=>!acc.has(s.value.toLowerCase())&&!dis.has(s.value.toLowerCase()))}
function acceptSuggestion(v){S.accepted=S.accepted||[];if(!S.accepted.some(x=>x.value===v))S.accepted.push({type:'role',value:v,at:new Date().toISOString()});save();toast(`${v} נוסף לחיפוש. ${N('hunter')} יחפש אותו מהסריקה הבאה`);renderProfile&&renderProfile();if($('sheet').classList.contains('open'))openMeeting()}
function dismissSuggestion(v){S.dismissed=S.dismissed||[];if(!S.dismissed.includes(v))S.dismissed.push(v);save();renderProfile&&renderProfile();if($('sheet').classList.contains('open'))openMeeting()}
function suggestionsHtml(){const L=pendingSuggestions();if(!L.length)return'';
  return `<h3 class="sub-h">הצעות מהישיבה של הצוות</h3>`+L.map(s=>`<div class="sg-card"><b lang="en">${escB(s.value)}</b><p>${escB(s.why)}</p>
    ${(s.examples||[]).length?`<ul class="sg-ex">${s.examples.map(e=>`<li><span lang="en">${escB(e.title)}</span> · ${escB(e.co)} · ${Number(e.fit).toFixed(1)}</li>`).join('')}</ul>`:''}
    ${(s.needs||[]).length?`<p class="sg-need">מה מבקשים שם ולא מופיע אצלך: <span lang="en">${escB(s.needs.join(', '))}</span></p>`:''}
    <div class="sg-btns"><button class="btn btn-sm btn-primary" onclick="acceptSuggestion('${escB(s.value).replace(/'/g,"\\'")}')">להוסיף לחיפוש</button><button class="btn btn-sm btn-ghost" onclick="dismissSuggestion('${escB(s.value).replace(/'/g,"\\'")}')">לא מעניין</button></div></div>`).join('')}
function openMeeting(){const m=lastMeeting();if(!m)return;const r=m.stats.report,d=new Date(m.created_at);
  const li=a=>a&&a.length?`<ul class="plan-list">${a.map(x=>`<li>${escB(x)}</li>`).join('')}</ul>`:'<p class="card-sub">אין.</p>';
  const pct=r.collected?Math.round(100*r.too_senior/r.collected):0;
  openSheet(`<h3 id="sheetTitle">הישיבה השבועית</h3><div class="sheet-sub">${escB(N('strategist'))} והצוות · ${d.toLocaleDateString('he-IL')}</div>
    <div class="mt-grid"><div><b>${r.scans}</b><span>סריקות</span></div><div><b>${r.collected}</b><span>משרות נאספו</span></div><div><b>${pct}%</b><span>בכירות מדי</span></div><div><b>${r.shown}</b><span>הוצגו לך</span></div>
      <div><b>${r.avg_fit==null?'—':r.avg_fit}</b><span>ציון ממוצע</span></div><div><b>${r.boards_ok}/${r.boards_total}</b><span>דפי קריירה נסרקים</span></div></div>
    <div class="s-sec"><h4>מה שמנו לב</h4>${li(r.issues)}</div>
    <div class="s-sec"><h4>מה שינינו לבד</h4>${li(r.actions)}</div>
    ${(r.skill_gaps||[]).length?`<div class="s-sec"><h4>כישורים שחסרים שוב ושוב</h4><p class="card-sub">במשרות שמתאימות לך. ${escB(N('coach'))} מכינה על זה חומר.</p><div class="learned">${r.skill_gaps.map(g=>`<span class="chip" lang="en">${escB(g.skill)} · ${g.jobs}</span>`).join('')}</div></div>`:''}
    <div class="s-sec">${suggestionsHtml()||'<h4>הצעות</h4><p class="card-sub">אין הצעות פתוחות.</p>'}</div>`)}

/* קובי: מה עשית ב-GitHub ולא כתוב בקורות החיים. אתה בוחר, רואה את השינוי, ומאשר */
function saveGithub(){const v=($('ghIn').value||'').trim().replace(/^@/,'').split('/').pop();const p=prof();p.ans=p.ans||{};p.ans.github=v;save();toast(v?`${N('linkedin')} יעבור על ה-GitHub שלך בשעתיים הקרובות`:'נמחק')}
function lastCvSuggest(){return (RUNS||[]).find(r=>r.agent==='linkedin'&&r.stats&&Array.isArray(r.stats.cv_suggest))||null}
function cvSuggestHtml(){const r=lastCvSuggest();if(!r||!r.stats.cv_suggest.length)return'';const done=new Set(S.cvDone||[]);
  const L=r.stats.cv_suggest.filter(x=>!done.has(x.line));if(!L.length)return'';
  return `<h3 class="sub-h">${escB(N('linkedin'))}: מה עשית ולא כתוב בקורות החיים</h3>`+L.map((x,i)=>`<label class="cvs-row"><input type="checkbox" class="cvs-ck" data-i="${r.stats.cv_suggest.indexOf(x)}" checked>
    <span><b dir="ltr" lang="en">${escB(x.line)}</b><em>${escB(x.why)}</em><a href="${escB(x.url)}" target="_blank" rel="noopener" lang="en">${escB(x.repo)}${x.proof?' · '+escB(x.proof):''}</a></span></label>`).join('')
    +`<button class="btn btn-sm btn-primary btn-block" style="margin-top:8px" onclick="previewCv()">לראות את קורות החיים המעודכנים</button>`}
function cvWithAdditions(cv,adds){const lines=cv.split('\n');
  adds.forEach(x=>{const w=(x.where||'').toLowerCase();let i=w?lines.findIndex(l=>l.toLowerCase().includes(w)):-1;
    if(i<0)i=lines.findIndex(l=>/^\s*projects\b/i.test(l));
    if(i<0){lines.push('','Additional','• '+x.line);return}
    let k=i+1;while(k<lines.length&&lines[k].trim()&&!/^[A-Z][A-Za-z &]{2,30}$/.test(lines[k].trim()))k++;
    lines.splice(k,0,'• '+x.line)});
  return lines.join('\n')}
function previewCv(){const r=lastCvSuggest(),sel=[...document.querySelectorAll('.cvs-ck')].filter(c=>c.checked).map(c=>r.stats.cv_suggest[+c.dataset.i]);
  if(!sel.length){toast('לא סימנת אף שורה');return}const cv=prof().cv||'',nu=cvWithAdditions(cv,sel);window.__cvNew={text:nu,sel};
  const set=new Set(sel.map(x=>'• '+x.line));
  openSheet(`<h3 id="sheetTitle">קורות החיים המעודכנים</h3><div class="sheet-sub">השורות החדשות מסומנות בירוק. שום דבר לא משתנה עד שתאשר.</div>
    <pre class="cv-pre" dir="ltr">${nu.split('\n').map(l=>set.has(l)?`<mark>${escB(l)}</mark>`:escB(l)).join('\n')}</pre>
    <div class="duo"><button class="btn btn-ghost" onclick="closeSheet()">ביטול</button><button class="btn btn-primary" onclick="applyCv()">לאשר ולעדכן</button></div>`)}
function applyCv(){const n=window.__cvNew;if(!n)return;prof().cv=n.text;S.cvDone=(S.cvDone||[]).concat(n.sel.map(x=>x.line));save();
  openSheet(`<h3 id="sheetTitle">קורות החיים עודכנו</h3><div class="sheet-sub">כל הסוכנים עובדים מעכשיו לפי הגרסה החדשה.</div>
    <p style="font-size:14px;margin:12px 0">אפשר לשמור כ-PDF: בחלון ההדפסה בוחרים "שמירה כ-PDF". זה PDF פשוט מהטקסט. אם יש לך קובץ מעוצב, אפשר להעתיק אליו את השורות החדשות.</p>
    <button class="btn btn-primary btn-block" onclick="cvPdf()">ל-PDF</button>`);renderProfile()}
function cvPdf(){const w=window.open('','_blank');if(!w){toast('הדפדפן חסם חלון חדש');return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>CV</title><style>body{font:12.5px/1.5 Arial,sans-serif;margin:28px;white-space:pre-wrap;direction:ltr}</style></head><body>${escB(prof().cv||'')}</body></html>`);w.document.close();setTimeout(()=>w.print(),300)}

/* מאיה: כרטיסי כישורים */
function lastSkills(){return (RUNS||[]).find(r=>r.agent==='coach'&&r.stats&&r.stats.skills)||null}
function skillsHtml(){const r=lastSkills();if(!r)return'';const {cards,project}=r.stats.skills;if(!(cards||[]).length)return'';
  return `<section class="card glass" aria-labelledby="skH"><h2 class="card-h" id="skH">כישורים שכדאי לחזק</h2>
    <div class="card-sub">${escB(N('coach'))}: אלה הדברים שחסרים שוב ושוב במשרות שמתאימות לך.</div>
    ${cards.map(c=>`<div class="sk-card"><div class="sk-h"><b lang="en">${escB(c.skill)}</b><span>חסר ב-${c.jobs} משרות${c.time?' · '+escB(c.time):''}</span></div>
      ${c.what?`<p>${escB(c.what)}</p>`:''}${c.how?`<p><b>איך מכניסים לפרויקט שלך:</b> ${escB(c.how)}</p>`:''}
      ${(c.examples||[]).length?`<p class="sk-ex">ביקשו את זה ב: ${escB(c.examples.join(' · '))}</p>`:''}
      ${(c.learn||[]).length?`<div class="sk-links">${c.learn.map(l=>`<a href="${escB(l.url)}" target="_blank" rel="noopener" dir="auto">${escB(l.title)} <span>${escB(l.site)}</span></a>`).join('')}</div>`:''}</div>`).join('')}
    ${project?`<div class="sk-card sk-proj"><div class="sk-h"><b>רעיון לפרויקט: <span lang="en">${escB(project.title)}</span></b>${(project.covers||[]).length?`<span lang="en">סוגר: ${escB(project.covers.join(', '))}</span>`:''}</div><p>${escB(project.pitch)}</p>
      <ol>${(project.steps||[]).map(x=>`<li>${escB(x)}</li>`).join('')}</ol></div>`:''}</section>`}

/* נתוני שימוש בסיסיים (ספירות בלבד, בלי תוכן) כדי שנדע מה עובד ומה לשפר */


/* דוח שימוש (רק לבעל המערכת) */
function openUsage(){const r=(RUNS||[]).find(x=>x.stats&&x.stats.usage_report);if(!r)return;const u=r.stats.usage_report;
  openSheet(`<h3 id="sheetTitle">דוח שימוש</h3><div class="sheet-sub">${new Date(r.created_at).toLocaleDateString('he-IL')} · ספירות בלבד, בלי תוכן</div>
  <div class="us-list">${u.rows.map(x=>`<div class="us-row"><b>${escB(x.name)}</b><span>${x.days_week} ימים השבוע · ${x.days} בסך הכל · אחרון ${escB(x.last||'—')}</span>
   <span>${x.cv?'קורות חיים ✓':'בלי קורות חיים'}${x.domain?' · '+escB(x.domain):''} · ${x.saved} שמורות · ${x.skipped} דילוגים · ${x.applied} הגשות · ${x.chat} שאלות בצ׳אט${x.add_job?' · '+x.add_job+' משרות מקישור':''}</span>
   ${(x.pages||[]).length?`<span>מסכים: ${x.pages.map(p=>escB(p[0])+' ('+p[1]+')').join(', ')}</span>`:''}</div>`).join('')}</div>
  ${(u.feedback||[]).length?`<div class="s-sec"><h4>משוב</h4>${u.feedback.map(f=>`<p class="us-fb"><b>${escB(f.name)}</b> · ${escB(f.at)}<br>${escB(f.t)}</p>`).join('')}</div>`:''}`)}

/* מפתח AI אישי (Groq, חינם): כל משתמש מקבל מכסה משלו, והסוכנים שלו לא מחכים בתור */
const maskKey=k=>k?k.slice(0,4)+'…'+k.slice(-4):'';
function aiKeyStep(){return `<h1>מפתח AI אישי, חינם</h1><p class="lead">ככה הסוכנים שלך עובדים במכסה משלך ולא מחכים בתור. לוקח דקה.</p>
  <a class="btn btn-primary btn-block" href="https://console.groq.com/keys" target="_blank" rel="noopener" onclick="track('groq_open')">לפתוח את Groq וליצור מפתח</a>
  <ol class="ak-steps"><li>נכנסים עם חשבון Google</li><li>לוחצים <bdi dir="ltr">Create API Key</bdi>, נותנים שם (למשל findjob), ומעתיקים</li><li>חוזרים לכאן ומדביקים</li></ol>
  <div class="field"><label for="akIn">המפתח שלך</label><div style="display:flex;gap:8px"><input id="akIn" class="ltr" placeholder="gsk_..." value="${escB(S.ai_key||'')}" autocomplete="off" spellcheck="false" oninput="akTyped()"><button class="btn btn-sm btn-ghost" onclick="akPaste()">להדביק</button></div>
  <div class="help" id="akHelp">${S.ai_key?'המפתח שמור ✓ '+escB(maskKey(S.ai_key)):'אפשר גם לדלג. הסוכנים יעבדו במכסה המשותפת, שמוגבלת.'}</div></div>`}
function akTyped(){const v=($('akIn').value||'').trim();const b=$('akBtn');if(b)b.disabled=!/^gsk_\w{20,}$/.test(v)}
async function akPaste(){try{const t=(await navigator.clipboard.readText()||'').trim();$('akIn').value=t;akTyped()}catch(e){toast('לא הצלחתי לקרוא מהלוח. אפשר להדביק ידנית')}}
async function saveAiKey(next){const v=(($('akIn')||{}).value||'').trim();if(!v&&S.ai_key){if(next)onbGo(1);return}
  const h=$('akHelp');if(!/^gsk_\w{20,}$/.test(v)){h.textContent='זה לא נראה כמו מפתח של Groq. הוא מתחיל ב-gsk_';return}
  h.textContent='בודק את המפתח…';
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/checkkey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:v,token:session&&session.access_token})});const d=await r.json();
    if(!d.ok){h.textContent=d.why==='invalid'?'Groq לא מכיר את המפתח הזה. כדאי להעתיק אותו שוב':'לא הצלחתי לבדוק כרגע. נסה שוב בעוד רגע';return}}
  catch(e){h.textContent='אין חיבור כרגע. נסה שוב';return}
  S.ai_key=v;track('ai_key');save();toast('המפתח נשמר. מעכשיו הסוכנים שלך עובדים במכסה משלך');
  if(next&&$('onb').classList.contains('open')){onbSingle?closeOnb():onbGo(1)}if(typeof renderSettings==='function')renderSettings()}
function removeAiKey(){S.ai_key='';save();renderSettings();toast('המפתח הוסר. הסוכנים יעבדו במכסה המשותפת')}
function aiKeyCard(){return `<section class="card glass" aria-labelledby="akH"><h2 class="card-h" id="akH">מפתח AI אישי</h2>
  ${S.ai_key?`<div class="row"><span class="rl"><b dir="ltr" style="text-align:right">${escB(maskKey(S.ai_key))}</b><span>הסוכנים שלך עובדים במכסה משלך ב-Groq</span></span><span class="pill-ok">פעיל</span></div>
    <div class="duo"><button class="btn btn-sm btn-ghost" onclick="openOnb(3)">להחליף</button><button class="btn btn-sm btn-ghost" onclick="removeAiKey()">להסיר</button></div>`
  :`<div class="card-sub">בלי מפתח אישי, הסוכנים עובדים במכסה משותפת ומוגבלת. מפתח חינמי לוקח דקה.</div>
    <button class="btn btn-sm btn-primary btn-block" onclick="openOnb(3)">ליצור מפתח חינמי</button>`}</section>`}
