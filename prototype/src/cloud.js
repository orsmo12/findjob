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
  const b=$('googleBtn'),h=$('loginHelp');btnBusy(b,true,'מעביר ל-Google…');
  const {error}=await SB.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:'select_account'}}});
  if(error){btnBusy(b,false);h.textContent='הכניסה עם Google לא הצליחה: '+error.message;h.style.color='var(--rose)'}
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
    SB.from('runs').select('agent,stats,plan,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(150)]);
  if(pr){const p=prof();p.first=pr.first||p.first;p.name=pr.name||p.name;p.cv=pr.cv_text||p.cv;p.ans=Object.assign({},pr.answers||{},p.ans||{});
    if(pr.team&&Object.keys(pr.team).length)S.team=pr.team;const st=pr.state||{};if(st.skip&&typeof st.skip==='object')S.skip=st.skip;if(Array.isArray(st.taste_off))S.taste_off=st.taste_off;['apps','todos','stories'].forEach(k=>{if(Array.isArray(st[k]))S[k]=st[k]});if(st.targets)S.targets=st.targets;if(Array.isArray(st.history))S.history=st.history;if(Array.isArray(st.chat))S.chat=st.chat;if(Array.isArray(st.accepted))S.accepted=st.accepted;if(Array.isArray(st.dismissed))S.dismissed=st.dismissed;if(Array.isArray(st.cvDone))S.cvDone=st.cvDone;if(st.usage)S.usage=st.usage;if(st.ai_key)S.ai_key=st.ai_key;if(Array.isArray(st.feedback))S.feedback=st.feedback;if(Array.isArray(st.my_letters))S.my_letters=st.my_letters;if(st.push)S.push=st.push;if(st.tourDone)S.tourDone=true;if(st.fb_status)S.fb_status=st.fb_status;p.li_text=pr.li_text||'';LI=Object.assign({},pr.li||{},{fixes:((pr.li_fixes||{}).fixes)||[]});if(pr.cv_text)S.onboarded=true}
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
function profRow(){const p=prof();return JSON.stringify({first:p.first||'',name:p.name||'',cv_text:p.cv||'',answers:p.ans||{},team:S.team||{},state:{skip:S.skip||{},taste_off:S.taste_off||[],apps:S.apps,todos:S.todos,stories:S.stories,targets:S.targets||{added:[],removed:[]},history:S.history||[],chat:(S.chat||[]).slice(-40),accepted:S.accepted||[],dismissed:S.dismissed||[],cvDone:S.cvDone||[],usage:S.usage||{},ai_key:S.ai_key||'',feedback:(S.feedback||[]).slice(-30),my_letters:(S.my_letters||[]).slice(0,5),push:S.push||null,tourDone:!!S.tourDone,fb_status:S.fb_status||{}},li_text:p.li_text||''})}
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
  const bt=setTimeout(()=>{const d=document.createElement('div');d.id='boot';d.innerHTML=`<div class="boot-msg">${LD()}<span>הצוות מעדכן את מה שהכין בשבילך…</span></div>`+skelHtml(3);document.body.appendChild(d)},300);
  try{await cloudLoad()}catch(e){console.warn(e);toast('אין חיבור לענן כרגע. מוצג מה ששמור במכשיר')}
  {const md=ME.user_metadata||{},p=prof(),full=(md.full_name||md.name||'').trim();
   if(full&&!p.name)p.name=full;if(full&&!p.first)p.first=full.split(/\s+/)[0];}
  closeOnb();init();
  clearTimeout(bt);{const d=$('boot');if(d){d.classList.add('out');setTimeout(()=>d.remove(),260)}}
  if(S.ak_pending&&!S.ai_key&&Date.now()-S.ak_pending<3600e3){   // חזר מיצירת מפתח והאפליקציה נטענה מחדש: ישר לשדה ההדבקה
    setTimeout(()=>{onbStep=3;onbSingle=!!S.onboarded;onbDraft=JSON.parse(JSON.stringify(prof()));$('onb').classList.add('open');renderOnb()},300);return}
  if(S.onboarded&&!S.tourDone)setTimeout(()=>{if(curPg==='main')tourStart()},1200);   // סיור פעם אחת
}
function cloudLogout(){SB.auth.signOut().then(()=>{LS.clear();location.reload()})}

/* צ׳אט עם שי: רואה את כל הנתונים שלך, זוכר את השיחה, ויכול להציע פעולה — שמתבצעת רק באישור שלך */
let chatFocus='';
async function cloudChat(v){
  track('chat');
  S.chat=S.chat||[];S.chat.push({role:'user',content:v});
  const typing=document.createElement('div');typing.className='msg bot typing ld-msg';typing.innerHTML=LD('ld-s');const tt=setTimeout(()=>{typing.insertAdjacentHTML('beforeend',`<span>${escB(N('assistant'))} בודק את הנתונים שלך…</span>`)},3000);$('chatMsgs').appendChild(typing);$('chatMsgs').scrollTop=1e6;
  let d={};
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:S.chat.slice(-14),token:session&&session.access_token,focus:chatFocus})});
    d=await r.json().catch(()=>({}));
    if(!d.reply)d.reply=d.error==='no_key'?'הצ׳אט עוד לא מחובר לשרת.':r.status===401?'צריך להתחבר מחדש.':d.error==='limit'?`הגעת היום ל-${d.limit} הודעות על המפתח המשותף, כדי שיישאר גם לאחרים. מחר זה מתאפס. עם מפתח AI אישי וחינמי (בהגדרות) אין הגבלה.`:'יש עומס כרגע. נסה שוב בעוד דקה.';
  }catch(e){d={reply:'אין חיבור כרגע. נסה שוב.'}}
  clearTimeout(tt);typing.remove();
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
    skip_job:`לדלג על ${n}`,remove_app:`להסיר את ${n} מההגשות`,add_todo:`להוסיף משימה: "${x.text}"`,add_story:`להוסיף לבנק הסיפורים: "${x.title}"`,add_role:`להוסיף לחיפוש את התפקיד ${x.role}`,remove_role:`להוריד מהחיפוש את התפקיד ${x.role}`,add_target:`להוסיף את ${x.name} לחברות היעד`,remove_target:`להסיר את ${x.name} מחברות היעד`,
    set_area:`לחפש באזורים: ${(x.locs||[]).join(', ')}`,set_mode:`לעדכן אופן עבודה: ${x.mode}`,add_exclude:`לא להציג משרות עם "${x.word}" בכותרת`,remove_exclude:`להציג שוב משרות עם "${x.word}"`,set_salary:`לעדכן ציפיות שכר: ${x.salary}`,add_channel:`להוסיף את ערוץ הטלגרם ${x.channel}`,feedback:`לשלוח למפתח את הבקשה: "${x.text}"`}[x.type]}
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
    case 'start_tour':if(chatOpen)toggleChat();setTimeout(()=>tourStart(),300);return true;
    case 'go_page':if(!['main','jobs','apps','prep','linkedin','office','profile','settings'].includes(x.page))return false;if(chatOpen)toggleChat();goPage(x.page);return true;
    case 'feedback':S.feedback=S.feedback||[];S.feedback.push({t:String(x.text||'').slice(0,1000),at:new Date().toISOString(),page:'chat'});track('feedback');break;
    case 'add_role':case 'remove_role':case 'add_target':case 'remove_target':case 'set_area':case 'set_mode':case 'add_exclude':case 'remove_exclude':case 'set_salary':case 'add_channel':
      if(!setPref(x))return false;save();if(curPg==='profile')renderProfile();toast(`עודכן. ${N('hunter')} יחפש לפי זה מהסריקה הבאה`);return true;
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
  btnBusy(btn,true);h.style.color='';const stop=stages(h,[`${N('hunter')} פותח את הקישור…`,'קורא את המודעה המלאה…','מדרג מול קורות החיים שלך: כישורים ורמת ניסיון…','עוד רגע, כותב למה זה מתאים ומה חסר…'],4000);
  let d={};
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/addjob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,text,token:session&&session.access_token})});
    d=await r.json().catch(()=>({}));if(!r.ok&&!d.error)d.error='http'}catch(e){d={error:'net'}}
  stop();btnBusy(btn,false);
  if(d.need_text){$('ajTextWrap').hidden=false;h.style.color='var(--ink2)';h.textContent='האתר לא מאפשר לקרוא את המשרה ישירות. העתק לשדה את התיאור שלה, ולחץ שוב על "הוספה".';$('ajText').focus();return}
  if(d.not_job){h.style.color='var(--rose)';h.textContent='זה לא נראה כמו מודעת משרה. בדוק את הקישור.';return}
  if(!d.card){h.style.color='var(--rose)';h.textContent=d.error==='auth'?'צריך להתחבר מחדש.':'משהו השתבש. נסה שוב בעוד דקה.';return}
  const c=Object.assign({},d.card,{letter:null,brief:null,prep:null});
  JOBS[c.id]=fromFeed({jobs:[c]})[c.id];if(!DECK.includes(c.id))DECK.push(c.id);
  S.decisions[c.id]='save';_decSnap[c.id]='save';
  if(!S.apps.find(a=>a.jobId===c.id))S.apps.unshift({id:'a-'+c.id,jobId:c.id,status:'saved',date:new Date().toISOString(),letter:''});
  save();closeSheet();
  toast(`${c.title} ב-${c.co}: התאמה ${c.fit} מתוך 5. נכנסה להגשות.${c.level_gap?' שים לב: '+c.level_gap+'.':''}`,{ms:5200});
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
const cvKey=x=>x.kind==='skill'?'skill:'+x.skill:x.line;
function cvPending(){const r=lastCvSuggest();if(!r)return[];const done=new Set(S.cvDone||[]);return r.stats.cv_suggest.filter(x=>!done.has(cvKey(x)))}
/* בפרופיל: שורה קצרה. הרשימה המלאה נפתחת בחלון */
function cvSuggestHtml(){const L=cvPending();if(!L.length)return'';const sk=L.filter(x=>x.kind==='skill').length,ln=L.length-sk;
  return `<button class="cvs-open" onclick="openCvSuggest()"><span><b>${escB(N('linkedin'))} מצא ${L.length} תוספות לקורות החיים</b><em>${[ln?`${ln} שורות על מה שעשית`:'',sk?`${sk} מילות מפתח לכישורים`:''].filter(Boolean).join(' · ')}. מתוך הריפוזיטוריז שלך ב-GitHub</em></span>${ICO.open||'›'}</button>`}
function openCvSuggest(){const r=lastCvSuggest(),L=cvPending();if(!L.length)return;
  const row=x=>`<label class="cvs-row"><input type="checkbox" class="cvs-ck" data-i="${r.stats.cv_suggest.indexOf(x)}" checked>
    <span><b dir="ltr" lang="en">${escB(x.line)}</b>${x.why?`<em>${escB(x.why)}</em>`:''}<a href="${escB(x.url)}" target="_blank" rel="noopener" lang="en">${escB(x.repo)}${x.proof?' · '+escB(x.proof):''}</a></span></label>`;
  const ln=L.filter(x=>x.kind!=='skill'),sk=L.filter(x=>x.kind==='skill');
  openSheet(`<h3 id="sheetTitle">תוספות לקורות החיים</h3><div class="sheet-sub">${escB(N('linkedin'))} מצא אותן בריפוזיטוריז שלך. רק מה שמופיע שם. מסמנים, רואים את התוצאה, ומאשרים.</div>
    ${ln.length?`<h4 class="sub-h">שורות חדשות</h4>${ln.map(row).join('')}`:''}
    ${sk.length?`<h4 class="sub-h">מילות מפתח לשורת הכישורים</h4>${sk.map(row).join('')}`:''}
    <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="previewCv()">לראות את קורות החיים המעודכנים</button>`)}
function cvWithAdditions(cv,adds){const lines=cv.split('\n');
  const skills=adds.filter(x=>x.kind==='skill').map(x=>x.skill);
  if(skills.length){let i=lines.findIndex(l=>/skills|technolog|tools|כישורים/i.test(l));
    if(i<0){lines.push('','Skills',skills.join(', '))}
    else{if(!/[:：]\s*\S/.test(lines[i])){let k=i+1;while(k<lines.length&&!lines[k].trim())k++;i=k<lines.length?k:i}
      lines[i]=lines[i].replace(/[\s,;.]*$/,'')+', '+skills.join(', ')}}
  adds.filter(x=>x.kind!=='skill').forEach(x=>{const w=(x.where||'').toLowerCase();let i=w?lines.findIndex(l=>l.toLowerCase().includes(w)):-1;
    if(i<0)i=lines.findIndex(l=>/^\s*projects\b/i.test(l));
    if(i<0){lines.push('','Additional','• '+x.line);return}
    let k=i+1;while(k<lines.length&&lines[k].trim()&&!/^[A-Z][A-Za-z &]{2,30}$/.test(lines[k].trim()))k++;
    lines.splice(k,0,'• '+x.line)});
  return lines.join('\n')}
function previewCv(){const r=lastCvSuggest(),sel=[...document.querySelectorAll('.cvs-ck')].filter(c=>c.checked).map(c=>r.stats.cv_suggest[+c.dataset.i]);
  if(!sel.length){toast('לא סימנת אף שורה');return}const cv=prof().cv||'',nu=cvWithAdditions(cv,sel);window.__cvNew={text:nu,sel};
  const set=new Set(sel.filter(x=>x.kind!=='skill').map(x=>'• '+x.line)),sks=sel.filter(x=>x.kind==='skill').map(x=>x.skill);
  openSheet(`<h3 id="sheetTitle">קורות החיים המעודכנים</h3><div class="sheet-sub">השורות החדשות מסומנות בירוק. שום דבר לא משתנה עד שתאשר.</div>
    <pre class="cv-pre" dir="ltr">${nu.split('\n').map(l=>set.has(l)?`<mark>${escB(l)}</mark>`:sks.some(k=>l.endsWith(k)||l.includes(', '+k+','))?escB(l).replace(new RegExp('(, )('+sks.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g'),'$1<mark>$2</mark>'):escB(l)).join('\n')}</pre>
    <div class="duo"><button class="btn btn-ghost" onclick="closeSheet()">ביטול</button><button class="btn btn-primary" onclick="applyCv()">לאשר ולעדכן</button></div>`)}
function applyCv(){const n=window.__cvNew;if(!n)return;prof().cv=n.text;S.cvDone=(S.cvDone||[]).concat(n.sel.map(cvKey));save();
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
   ${(x.pages||[]).length?`<span>מסכים: ${x.pages.map(p=>escB(p[0])+' ('+p[1]+')').join(', ')}</span>`:''}
   ${x.stuck||x.tour?`<span>${x.stuck?'נעצר: '+escB(x.stuck):'עבר את כל השלבים'}${x.tour?' · סיור: '+escB(x.tour):''}</span>`:''}</div>`).join('')}</div>
  ${(u.feedback||[]).length?`<div class="s-sec"><h4>משוב</h4>${u.feedback.map(f=>`<p class="us-fb"><b>${escB(f.name)}</b> · ${escB(f.at)}<br>${escB(f.t)}</p>`).join('')}</div>`:''}`)}

/* מפתח AI אישי (Groq, חינם): כל משתמש מקבל מכסה משלו, והסוכנים שלו לא מחכים בתור */
const maskKey=k=>k?k.slice(0,4)+'…'+k.slice(-4):'';
/* ═════════ מפתח AI אישי: Groq / Gemini (חינם) או Claude / OpenAI (בתשלום) ═════════
   מסך קצר. ההסבר המלא בחלון "למה זה חשוב?". יצירת המפתח נפתחת בחלון נפרד, וכשחוזרים
   (גם אם האפליקציה נטענה מחדש) נוחתים ישר על שדה ההדבקה. הספק מזוהה לבד מתחילת המפתח. */
const AK={groq:{n:'Groq',tag:'חינם',url:'https://console.groq.com/keys',ph:'gsk_...',re:/^gsk_\w{20,}$/,steps:['נכנסים עם חשבון Google','לוחצים <bdi dir="ltr">Create API Key</bdi> ומעתיקים']},
  gemini:{n:'Gemini',tag:'חינם',url:'https://aistudio.google.com/apikey',ph:'AIza...',re:/^AIza[\w-]{30,}$/,steps:['נכנסים עם חשבון Google','לוחצים <bdi dir="ltr">Create API key</bdi> ומעתיקים']},
  anthropic:{n:'Claude',tag:'בתשלום',url:'https://console.anthropic.com/settings/keys',ph:'sk-ant-...',re:/^sk-ant-[\w-]{20,}$/,steps:['נכנסים לחשבון המפתחים (נפרד מהמנוי)','טוענים קרדיט, לוחצים <bdi dir="ltr">Create Key</bdi> ומעתיקים']},
  openai:{n:'OpenAI',tag:'בתשלום',url:'https://platform.openai.com/api-keys',ph:'sk-...',re:/^sk-(?!ant-)[\w-]{20,}$/,steps:['נכנסים לחשבון המפתחים (נפרד מ-ChatGPT Plus)','טוענים קרדיט, לוחצים <bdi dir="ltr">Create new secret key</bdi> ומעתיקים']}};
const akProvOf=k=>{k=(k||'').trim();return k.startsWith('gsk_')?'groq':k.startsWith('AIza')?'gemini':k.startsWith('sk-ant-')?'anthropic':k.startsWith('sk-')?'openai':''};
const akValid=k=>{const p=akProvOf(k);return !!p&&AK[p].re.test((k||'').trim())};
let akProv=null;
function aiKeyStep(){const p=akProv||akProvOf(S.ai_key)||'groq',c=AK[p],back=S.ak_pending&&!S.ai_key;
  return `<h1>מפתח AI אישי</h1><p class="lead">לוקח דקה, והסוכנים שלך עובדים מהר יותר. <button class="link" onclick="akWhy()">למה זה חשוב?</button></p>
  <div class="ak-prov" role="radiogroup" aria-label="ספק">${Object.entries(AK).map(([k,v])=>`<button role="radio" aria-checked="${k===p}" class="${k===p?'on':''}" onclick="akProv='${k}';renderOnb()"><b>${v.n}</b><span class="${v.tag==='חינם'?'free':''}">${v.tag}</span></button>`).join('')}</div>
  ${back?`<div class="ak-back">חזרת? מדביקים את המפתח כאן למטה.</div>`:`<button class="btn btn-primary btn-block" onclick="akOpen('${p}')">לפתוח את ${c.n} וליצור מפתח</button>
  <ol class="ak-steps">${c.steps.map(x=>`<li>${x}</li>`).join('')}<li>סוגרים את החלון שנפתח (✕) ומדביקים כאן</li></ol>`}
  <div class="field"><label for="akIn">המפתח שלך</label><div style="display:flex;gap:8px"><input id="akIn" class="ltr" placeholder="${c.ph}" value="${escB(S.ai_key||'')}" autocomplete="off" spellcheck="false" oninput="akTyped()"><button class="btn btn-sm btn-ghost" onclick="akPaste()">להדביק</button></div>
  <div class="help" id="akHelp">${S.ai_key?'המפתח שמור ✓ '+escB(maskKey(S.ai_key)):''}</div></div>
  ${back?`<button class="link-btn" onclick="S.ak_pending=0;save();renderOnb()">לפתוח שוב את ${c.n}</button>`:''}`}
function akOpen(p){S.ak_pending=Date.now();save();track('key_open',{p});
  const w=window.open(AK[p].url,'_blank','noopener');if(!w)location.href=AK[p].url;setTimeout(()=>{if($('onb').classList.contains('open'))renderOnb()},400)}
/* חזרה מהחלון: מרעננים את המסך כך שיופיע שדה ההדבקה בראש */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.ak_pending&&!S.ai_key&&$('onb')&&$('onb').classList.contains('open')&&onbStep===3){renderOnb();setTimeout(()=>$('akIn')&&$('akIn').focus(),150)}});
function akWhy(){openSheet(`<h2 class="sheet-h">למה מפתח אישי?</h2>
  <div class="ak-why-full">
    <p><b>בלי מפתח</b> כל המשתמשים חולקים מכסה יומית אחת. ביום עמוס הסריקות והמכתבים שלך יכולים להתעכב.</p>
    <p><b>עם מפתח</b> יש לך מכסה משלך: יותר משרות מדורגות בכל סריקה, צ׳אט בלי הגבלה יומית, ומכתבים מהר יותר.</p>
    <p><b>Groq ו-Gemini</b> חינמיים, בלי כרטיס אשראי. Gemini נוח אם כבר יש לך חשבון Google.</p>
    <p><b>Claude ו-OpenAI</b> בתשלום לפי שימוש (בערך כמה דולרים בחודש). חשוב: מנוי כמו Claude Pro, Gemini Advanced או ChatGPT Plus הוא לצ׳אט באתר שלהם, ולא כולל מפתח. המפתח נוצר בנפרד, באתר המפתחים.</p>
    <p><b>פרטיות:</b> המפתח נשמר בחשבון שלך ומשמש רק את הסוכנים שלך. אפשר להחליף או להסיר בהגדרות בכל רגע.</p>
    <p>אם המפתח מפסיק לעבוד (למשל נגמר הקרדיט), הסוכנים עוברים לבד למכסה המשותפת ולא נעצרים.</p>
  </div><button class="btn btn-primary btn-block" onclick="closeSheet()">הבנתי</button>`)}
function akTyped(){const v=($('akIn').value||'').trim(),b=$('akBtn'),p=akProvOf(v);if(b)b.disabled=!akValid(v);
  if(p&&p!==(akProv||'groq')&&v.length>8){akProv=p;document.querySelectorAll('.ak-prov button').forEach(x=>{const on=x.textContent.startsWith(AK[p].n);x.classList.toggle('on',on);x.setAttribute('aria-checked',on)})}}
async function akPaste(){try{const t=(await navigator.clipboard.readText()||'').trim();$('akIn').value=t;akTyped()}catch(e){toast('לא הצלחתי לקרוא מהלוח. אפשר להדביק ידנית')}}
async function saveAiKey(next){const v=(($('akIn')||{}).value||'').trim();if(!v&&S.ai_key){if(next)onbGo(1);return}
  const h=$('akHelp');if(!akValid(v)){h.textContent='זה לא נראה כמו מפתח. מפתח של Groq מתחיל ב-gsk_, של Gemini ב-AIza, של Claude ב-sk-ant- ושל OpenAI ב-sk-';return}
  const c=AK[akProvOf(v)],kb=$('akBtn');btnBusy(kb,true);const stop=stages(h,[`בודק את המפתח מול ${c.n}…`]);
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/checkkey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:v,token:session&&session.access_token})});const d=await r.json();
    stop();btnBusy(kb,false);if(!d.ok){h.textContent=d.why==='invalid'?`${c.n} לא מכיר את המפתח הזה. כדאי להעתיק אותו שוב`:d.why==='format'?'זה לא נראה כמו מפתח':'לא הצלחתי לבדוק כרגע. נסה שוב בעוד רגע';return}}
  catch(e){stop();btnBusy(kb,false);h.textContent='אין חיבור כרגע. נסה שוב';return}
  S.ai_key=v;S.ak_pending=0;track('ai_key',{p:akProvOf(v)});save();toast(`המפתח נשמר. מעכשיו הסוכנים שלך עובדים במכסה משלך ב-${c.n}`);
  if(next&&$('onb').classList.contains('open')){onbSingle?closeOnb():onbGo(1)}if(typeof renderSettings==='function')renderSettings()}
function removeAiKey(){S.ai_key='';save();renderSettings();toast('המפתח הוסר. הסוכנים יעבדו במכסה המשותפת')}
function aiKeyCard(){return `<section class="card glass" aria-labelledby="akH"><h2 class="card-h" id="akH">מפתח AI אישי</h2>
  ${S.ai_key?`<div class="row"><span class="rl"><b dir="ltr" style="text-align:right">${escB(maskKey(S.ai_key))}</b><span>הסוכנים שלך עובדים במכסה משלך ב-${escB((AK[akProvOf(S.ai_key)]||AK.groq).n)}</span></span><span class="pill-ok">פעיל</span></div>
    <div class="duo"><button class="btn btn-sm btn-ghost" onclick="openOnb(3)">להחליף</button><button class="btn btn-sm btn-ghost" onclick="removeAiKey()">להסיר</button></div>`
  :`<div class="card-sub">בלי מפתח אישי, הסוכנים עובדים במכסה משותפת ומוגבלת. מפתח חינמי (Groq או Gemini) לוקח דקה, ואפשר גם Claude או OpenAI.</div>
    <button class="btn btn-sm btn-primary btn-block" onclick="openOnb(3)">להוסיף מפתח</button>`}</section>`}

/* "להכין עכשיו": ריצה של הסוכנים רק בשבילך (מכתב, סקירה, הכנה, התאמת קורות חיים, בדיקה שהמשרות פתוחות) */
let _prep=null;
async function prepNow(kind){kind=kind==='scan'?'scan':'prep';
  if(_prep){toast('הסוכנים כבר עובדים. אפשר להמשיך להשתמש באפליקציה');return}
  closeSheet();let d={},r;
  try{const {data:{session}}=await SB.auth.getSession();
    r=await fetch('/api/prepnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:session&&session.access_token,kind})});d=await r.json()}catch(e){}
  if(!r||!d.ok){if(d.error==='no_cv'){toast(`צריך קודם קורות חיים. בלעדיהם ${N('hunter')} לא יכול לחפש`);goPage('profile');return}toast(d.error==='wait'?`אפשר להפעיל פעם ב-10 דקות. עוד ${d.minutes} דק׳`:d.error==='no_token'?'הכפתור עוד לא מחובר. המפתח צריך להשלים הגדרה אחת':d.error==='auth'?'צריך להתחבר מחדש':'לא הצלחתי להפעיל. נסה שוב בעוד דקה');return}
  track(kind==='scan'?'scan_first':'prep_now');_prep={at:d.at,t0:Date.now(),scan:kind==='scan'};prepBar();if(curPg==='jobs')renderJobs();_prep.timer=setInterval(prepPoll,15000);
}
function prepBar(done){let b=$('prepBar');if(!b){b=document.createElement('div');b.id='prepBar';b.setAttribute('role','status');document.body.appendChild(b)}
  if(done){b.innerHTML=_prep&&_prep.scan?`<b>מוכן ✓</b><span>המשרות הראשונות מחכות לך במסך המשרות.</span>`:`<b>מוכן ✓</b><span>הכל עודכן. המכתבים, הסקירות וההכנה מחכים בהגשות.</span>`;b.classList.add('done');setTimeout(()=>b.remove(),6000);return}
  const p=Math.min(92,Math.round((Date.now()-_prep.t0)/(_prep.scan?9000:2400)));
  b.innerHTML=_prep.scan?`<b>${LD('ld-s')} ${escB(N('hunter'))} מחפש לך משרות ראשונות</b><span>בדרך כלל 8 עד 15 דקות. אפשר לסגור את האפליקציה, הכל יחכה כאן.</span><i><u style="width:${p}%"></u></i>`
    :`<b>${LD('ld-s')} הסוכנים עובדים בשבילך</b><span>בדרך כלל 2 עד 4 דקות. בסיום הכל יופיע בהגשות ובמשרד.</span><i><u style="width:${p}%"></u></i>`}
async function prepPoll(){if(!_prep)return;prepBar();
  try{const {data}=await SB.from('runs').select('plan,created_at').eq('user_id',ME.id).eq('agent','assistant').gte('created_at',_prep.at).not('plan','is',null).limit(5);
    if((data||[]).some(x=>x.plan&&x.plan.prep_done)){clearInterval(_prep.timer);_prep=null;await cloudLoad();if(typeof refreshApps==='function')refreshApps();prepBar(true);return}}catch(e){}
  if(Date.now()-_prep.t0>(_prep.scan?30:9)*60e3){clearInterval(_prep.timer);_prep=null;const b=$('prepBar');if(b)b.remove();toast('זה לוקח יותר מהרגיל. התוצאות יופיעו כשהריצה תסתיים');try{await cloudLoad();refreshApps()}catch(e){}}}

/* התראות לטלפון (Web Push). המפתח הציבורי של השרת. ריק = עוד לא הוגדר */
const VAPID_PUB='BIJTs9qVwO1m9UMkTlwH31BdzRQcVen8aESezqiYeSad9bZuaBlyuvSmMQ6hBkLGEOUbH3NiXjyfUsmHULBhJxs';
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
const b64u=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
async function pushToggle(){
  if(S.push){try{const r=await navigator.serviceWorker.ready,sub=await r.pushManager.getSubscription();if(sub)await sub.unsubscribe()}catch(e){}
    S.push=null;save();renderSettings();toast('ההתראות כבויות');return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(ios&&!standalone){openSheet(`<h3 id="sheetTitle">קודם להוסיף למסך הבית</h3><div class="sheet-sub">באייפון התראות עובדות רק מאפליקציה שהוספת למסך הבית (iOS 16.4 ומעלה).</div>
    <ol class="how-ol"><li>בספארי לוחצים על כפתור השיתוף</li><li>בוחרים "הוסף למסך הבית"</li><li>פותחים את findjob מהמסך הבית ומפעילים כאן שוב</li></ol>`);return}
  if(!VAPID_PUB||!('PushManager' in window)){toast(VAPID_PUB?'הדפדפן הזה לא תומך בהתראות':'ההתראות עוד לא מחוברות. המפתח צריך להשלים הגדרה אחת');return}
  const perm=await Notification.requestPermission();if(perm!=='granted'){toast('צריך לאשר התראות בדפדפן');return}
  const pb=document.querySelector('[onclick="pushToggle()"]');if(pb){pb.disabled=true;pb.setAttribute('aria-busy','true')}$('nb')&&$('nb').insertAdjacentHTML('beforeend',' '+LD('ld-s'));
  try{const r=await navigator.serviceWorker.ready,sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID_PUB)});
    S.push=sub.toJSON();track('push_on');save();renderSettings();toast(`מופעל. ${N('hunter')} ישלח הודעה כשיש משרות חדשות`)}catch(e){toast('לא הצלחתי להפעיל התראות בדפדפן הזה')}if(pb)pb.disabled=false;renderSettings()}

/* מחיקת החשבון: פונקציה במסד שמוחקת רק את המשתמש המחובר, וכל הנתונים שלו נמחקים איתו */
async function deleteAccount(){btnBusy(document.querySelector('[onclick^="deleteAccount"]'),true,'מוחק…');
  const {error}=await SB.rpc('delete_my_account');
  if(error){   // אם הפונקציה עוד לא הותקנה: מוחקים לפחות את מה שמותר מהאפליקציה
    await SB.from('jobs').delete().eq('user_id',ME.id);await SB.from('profiles').delete().eq('user_id',ME.id);
    toast('הנתונים נמחקו. את החשבון עצמו המפתח ימחק ידנית');}
  try{await SB.auth.signOut()}catch(e){}LS.clear();setTimeout(()=>location.reload(),error?2500:300)}

/* שי משנה הגדרות חיפוש, רק אחרי אישור בכרטיס */
const AREAS=['תל אביב','גוש דן והמרכז','השרון','ירושלים','חיפה והצפון','באר שבע והדרום'],MODES=['מהמשרד','היברידי','מהבית','לא משנה לי'],SALS=['עד ₪12K','₪12–16K','₪16–20K','₪20–25K','₪25K ומעלה'];
function setPref(x){const p=prof();p.ans=p.ans||{};const a=p.ans,clean=v=>String(v||'').trim().slice(0,60),T=S.targets=S.targets||{added:[],removed:[]};
  const lower=(L,v)=>L.findIndex(y=>y.toLowerCase()===v.toLowerCase());
  switch(x.type){
    case 'add_role':{const r=clean(x.role);if(!r)return false;a.roles=a.roles||[];if(lower(a.roles,r)<0)a.roles.push(r);return true}
    case 'remove_role':{const i=lower(a.roles||[],clean(x.role));if(i<0)return false;a.roles.splice(i,1);return true}
    case 'add_target':{const n=clean(x.name);if(!n)return false;T.removed=T.removed.filter(v=>v.toLowerCase()!==n.toLowerCase());if(lower(T.added,n)<0)T.added.unshift(n);return true}
    case 'remove_target':{const n=clean(x.name);if(!n)return false;T.added=T.added.filter(v=>v.toLowerCase()!==n.toLowerCase());if(lower(T.removed,n)<0)T.removed.push(n);return true}
    case 'set_area':{const L=(x.locs||[]).filter(v=>AREAS.includes(v));if(!L.length)return false;a.locs=L;return true}
    case 'set_mode':if(!MODES.includes(x.mode))return false;a.mode=x.mode;return true;
    case 'add_exclude':{const w=clean(x.word);if(!w)return false;a.exclude=a.exclude||[];if(lower(a.exclude,w)<0)a.exclude.push(w);return true}
    case 'remove_exclude':{const i=lower(a.exclude||[],clean(x.word));if(i<0)return false;a.exclude.splice(i,1);return true}
    case 'set_salary':if(!SALS.includes(x.salary))return false;a.salary=x.salary;return true;
    case 'add_channel':{const ch=chName(x.channel);if(!ch)return false;a.telegram=a.telegram||[];if(!a.telegram.includes(ch))a.telegram.push(ch);return true}
  }return false}

/* ═════════ כלי מפתח: רק לבעלים (מי שמקבל את דוח השימוש) ═════════ */
const isOwner=()=>!!((typeof RUNS!=='undefined'&&RUNS)||[]).find(x=>x.stats&&x.stats.usage_report);
const FB_ST={'':'חדש',got:'התקבלה',doing:'בעבודה',done:'נוספה',no:'לא כרגע'};
/* תובנות שבועיות על החיפוש (scripts/insights.py, נשמר בסריקת הבוקר של יום ראשון) */
function openInsights(){const r=(RUNS||[]).find(x=>x.stats&&x.stats.insights);if(!r)return;
  openSheet(`<h3 id="sheetTitle">תובנות על החיפוש</h3><div class="sheet-sub">מ-${new Date(r.created_at).toLocaleDateString('he-IL')}, 7 הימים האחרונים. אנונימי.</div>
    <pre class="dev-ins">${esc(r.stats.insights)}</pre>`)}
function openDev(){const ur=(RUNS||[]).find(x=>x.stats&&x.stats.usage_report),u=ur?ur.stats.usage_report:{rows:[],feedback:[]};
  const fails=(RUNS||[]).filter(r=>r.stats&&Array.isArray(r.stats.failures)&&Date.now()-new Date(r.created_at)<14*864e5);
  const fb=u.feedback||[],st=S.fb_status||{};
  openSheet(`<h3 id="sheetTitle">כלי מפתח <span class="dev-tag">מפתח</span></h3><div class="sheet-sub">רק אתה רואה את זה. ${ur?'הדוח מ-'+new Date(ur.created_at).toLocaleDateString('he-IL'):'הדוח הראשון יגיע בסריקת הבוקר'}.</div>
    <div class="dev-sum"><span><b class="num">${u.rows.length}</b> משתמשים</span><span><b class="num">${u.rows.filter(r=>r.days_week).length}</b> פעילים השבוע</span><span><b class="num">${fb.filter(f=>!st[f.key]).length}</b> משובים חדשים</span><span class="${fails.length?'bad':''}"><b class="num">${fails.length}</b> ריצות עם תקלות</span></div>
    <button class="btn btn-sm btn-ghost btn-block" onclick="openUsage()">דוח שימוש מלא</button>
    ${(RUNS||[]).find(x=>x.stats&&x.stats.insights)?`<button class="btn btn-sm btn-ghost btn-block" onclick="openInsights()">תובנות שבועיות על החיפוש</button>`:''}
    ${(u.funnel||[]).length?`<h4 class="sub-h">משפך: כמה משתמשים הגיעו לכל שלב</h4><div class="dev-fun">${u.funnel.map(([l,n])=>`<div><span>${escB(l)}</span><i style="width:${u.rows.length?Math.round(100*n/u.rows.length):0}%"></i><b class="num">${n}</b></div>`).join('')}</div>`:''}
    ${(u.errors||[]).length?`<h4 class="sub-h">שגיאות באפליקציה אצל משתמשים</h4><ul class="dev-err">${u.errors.map(([m,n])=>`<li><b class="num">${n}×</b> <span dir="ltr">${escB(m)}</span></li>`).join('')}</ul>`:''}
    <h4 class="sub-h">משובים ובקשות</h4>
    ${fb.length?fb.map(f=>`<div class="dev-fb"><div><b>${escB(f.name)}</b> · ${escB(f.at)}</div><p>${escB(f.t)}</p>
      <label class="vh" for="fb-${escB(f.key)}">סטטוס</label><select id="fb-${escB(f.key)}" onchange="setFbStatus('${escB(f.key)}',this.value)">${Object.entries(FB_ST).map(([k,l])=>`<option value="${k}"${(st[f.key]||'')===k?' selected':''}>${l}</option>`).join('')}</select></div>`).join('')
      :'<p class="card-sub">אין משובים מהחודש האחרון.</p>'}
    <p class="card-sub">כשמשנים סטטוס, המשתמש מקבל הודעה בסריקת הבוקר.</p>
    <h4 class="sub-h">ריצות עם תקלות (14 ימים)</h4>
    ${fails.length?fails.map(r=>`<div class="dev-fb"><div><b>${escB(r.stats.job||'ריצה')}</b> · ${new Date(r.created_at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}${r.stats.run?` · <a class="ext" href="${escB(r.stats.run)}" target="_blank" rel="noopener">ליומן</a>`:''}</div>
      <ul>${r.stats.failures.slice(0,6).map(f=>`<li dir="auto">${escB(f.where)} · ${escB(f.user)} · <span dir="ltr">${escB(f.error)}</span></li>`).join('')}</ul></div>`).join('')
      :'<p class="card-sub">אין תקלות. הכל רץ.</p>'}`)}
function setFbStatus(k,v){S.fb_status=Object.assign({},S.fb_status);if(v)S.fb_status[k]=v;else delete S.fb_status[k];save();toast('נשמר. המשתמש יקבל עדכון בבוקר')}
