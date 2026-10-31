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
    SB.from('runs').select('agent,stats,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(40)]);
  if(pr){const p=prof();p.first=pr.first||p.first;p.name=pr.name||p.name;p.cv=pr.cv_text||p.cv;p.ans=Object.assign({},pr.answers||{},p.ans||{});
    if(pr.team&&Object.keys(pr.team).length)S.team=pr.team;const st=pr.state||{};['apps','todos','stories'].forEach(k=>{if(Array.isArray(st[k]))S[k]=st[k]});if(st.targets)S.targets=st.targets;p.li_text=pr.li_text||'';LI=pr.li||{};if(pr.cv_text)S.onboarded=true}
  prof().key='cloud';
  RUNS=runs||[];const hr=RUNS.filter(r=>(r.agent||'hunter')==='hunter');
  if(hr.length){
    const live=(jobs||[]).filter(r=>r.decision!=='skip'||S.decisions[r.id]);
    setFeed({generated_at:hr[0].created_at,stats:hr[0].stats||{},jobs:live.map(r=>Object.assign({},r.card,{letter:r.letter||null,brief:r.brief||null,prep:r.prep||null})).sort((a,b)=>b.fit-a.fit)});
    (jobs||[]).forEach(r=>{if(r.decision)S.decisions[r.id]=r.decision});
  }
  S.apps=(S.apps||[]).filter(a=>JOBS[a.jobId]);
  _decSnap=Object.assign({},S.decisions);_profSnap=profRow();
  LS.set(SKEY,S);window.__runsReady=true;if(typeof applyTeam==='function')applyTeam();buildWorkflow();
}
function profRow(){const p=prof();return JSON.stringify({first:p.first||'',name:p.name||'',cv_text:p.cv||'',answers:p.ans||{},team:S.team||{},state:{apps:S.apps,todos:S.todos,stories:S.stories,targets:S.targets||{added:[],removed:[]}},li_text:p.li_text||''})}
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

/* צ׳אט אמיתי עם שי: שרת קטן ב-Vercel, רק עם הנתונים שלך */
async function cloudChat(v){
  CHAT.push({role:'user',content:v});
  const typing=document.createElement('div');typing.className='msg bot typing';typing.textContent='…';$('chatMsgs').appendChild(typing);$('chatMsgs').scrollTop=1e6;
  let reply='';
  try{const {data:{session}}=await SB.auth.getSession();
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:CHAT.slice(-12),token:session&&session.access_token})});
    const d=await r.json().catch(()=>({}));
    reply=d.reply||(d.error==='no_key'?'הצ׳אט עוד לא מחובר לשרת. זה צעד אחד בהגדרות של Vercel.':r.status===401?'צריך להתחבר מחדש.':'יש עומס כרגע. נסה שוב בעוד דקה.');
  }catch(e){reply='אין חיבור כרגע. נסה שוב.'}
  typing.remove();CHAT.push({role:'assistant',content:reply});addMsg('bot',reply);
}
/* הודעות המשרד: מה הסוכנים עשו בפועל */
function realUpdates(){
  const seat=k=>{const i=CAREER.agents.findIndex(a=>a.key===k);return i<0?0:i};
  const ago=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<60?`לפני ${Math.max(1,m)} דק׳`:m<1440?`לפני ${Math.round(m/60)===1?'שעה':Math.round(m/60)+' שעות'}`:m<2880?'אתמול':new Date(t).toLocaleDateString('he-IL')};
  return RUNS.filter(r=>r.stats&&r.stats.msg).map(r=>({a:seat(r.agent||'hunter'),time:ago(r.created_at),body:r.stats.msg}));
}
