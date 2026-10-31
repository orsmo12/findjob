/* ═════════ CLOUD — חיבור ל-Supabase (רק בגרסה המאוחסנת) ═════════
   התחברות בקישור למייל. הפרופיל, קורות החיים והשאלון נשמרים בענן, והסוכנים קוראים אותם משם בלילה.
   המשרות שדורון מצא נטענות מהענן. כל משתמש רואה רק את הנתונים שלו (RLS). */
let SB=null,ME=null,_profSnap='',_decSnap={},_syncT=null;
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
    SB.from('jobs').select('id,card,decision,letter,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(200),
    SB.from('runs').select('stats,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1)]);
  if(pr){const p=prof();p.first=pr.first||p.first;p.name=pr.name||p.name;p.cv=pr.cv_text||p.cv;p.ans=Object.assign({},pr.answers||{},p.ans||{});
    if(pr.team&&Object.keys(pr.team).length)S.team=pr.team;const st=pr.state||{};['apps','todos','stories'].forEach(k=>{if(Array.isArray(st[k]))S[k]=st[k]});if(pr.cv_text)S.onboarded=true}
  prof().key='cloud';
  if(runs&&runs.length){
    const live=(jobs||[]).filter(r=>r.decision!=='skip'||S.decisions[r.id]);
    setFeed({generated_at:runs[0].created_at,stats:runs[0].stats||{},jobs:live.map(r=>Object.assign({},r.card,{letter:r.letter||null})).sort((a,b)=>b.fit-a.fit)});
    (jobs||[]).forEach(r=>{if(r.decision)S.decisions[r.id]=r.decision});
  }
  S.apps=(S.apps||[]).filter(a=>JOBS[a.jobId]);
  _decSnap=Object.assign({},S.decisions);_profSnap=profRow();
  LS.set(SKEY,S);if(typeof applyTeam==='function')applyTeam();
}
function profRow(){const p=prof();return JSON.stringify({first:p.first||'',name:p.name||'',cv_text:p.cv||'',answers:p.ans||{},team:S.team||{},state:{apps:S.apps,todos:S.todos,stories:S.stories}})}
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
