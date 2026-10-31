// ── OFFICE CHARACTERS (The Office cast) — 6 palettes ──
const OFF_CHARS=[
  // Michael Scott: dark brown slicked-back, charcoal-navy suit, light-blue shirt, blue-grey tie
  {skin:'#f1c27d',hair:'#3b2209',shirt:'#ddeaff',tie:'#6b83a8',pants:'#2c3448',suit:'#2e3448',name:'Michael'},
  // Dwight Schrute: light-brown curtain bangs, glasses, mustard shirt, brown tie
  {skin:'#f5d5a8',hair:'#9b7a4a',shirt:'#f0c040',tie:'#7a5c30',pants:'#5a4a32',glasses:true,name:'Dwight'},
  // Jim Halpert: medium-brown shaggy, light-blue rolled shirt, black tie
  {skin:'#ffdbac',hair:'#7a5030',shirt:'#b8d8f0',tie:'#1a1a1a',pants:'#c8b890',rolled:true,name:'Jim'},
  // Pam Beesly: strawberry-blonde half-up, pink cardigan, white blouse
  {skin:'#f6cfa6',hair:'#d4896a',shirt:'#f5f5f5',cardigan:'#dba8c8',woman:true,name:'Pam'},
  // Kevin Malone: dark-brown balding, boxy grey-brown suit, white shirt, brown tie
  {skin:'#e8b88a',hair:'#2a1a0e',shirt:'#f8f8f8',tie:'#8a6a4a',pants:'#4a4040',suit:'#6a6258',balding:true,name:'Kevin'},
  // Stanley Hudson: black+grey buzz+mustache, navy suit, bold red tie
  {skin:'#8d5524',hair:'#1a1a1a',shirt:'#f8f8f8',tie:'#cc2222',pants:'#2a3060',suit:'#1e2a4a',mustache:true,glasses2:true,name:'Stanley'},
];
// map domain agents to character indices
const CHAR_MAP=[0,1,2,3,4,5];

// ── MINI FACE CANVAS ──
function drawFace(canvas, charIdx, state){
  const cv=canvas;
  cv.width=96;cv.height=96;
  const ctx=cv.getContext('2d');
  const S=3;
  ctx.setTransform(S,0,0,S,0,0);
  ctx.imageSmoothingEnabled=false;
  const W=32,H=32;
  const p=OFF_CHARS[charIdx%OFF_CHARS.length];
  const cx=16,cy=20;
  // background
  ctx.fillStyle='#E8EBF5';ctx.fillRect(0,0,W,H);
  // body / torso
  const topC=p.cardigan||p.shirt;
  ctx.fillStyle=topC;ctx.fillRect(cx-6,cy+5,12,10);
  if(p.suit){ctx.fillStyle=p.suit;ctx.fillRect(cx-6,cy+5,3,10);ctx.fillRect(cx+3,cy+5,3,10);}
  if(p.cardigan){ctx.fillStyle=p.shirt;ctx.fillRect(cx-2,cy+5,4,3);}
  if(p.tie){ctx.fillStyle=p.tie;ctx.fillRect(cx-1,cy+5,2,8);}
  // neck
  ctx.fillStyle=p.skin;ctx.fillRect(cx-2,cy+3,4,4);
  // head
  ctx.fillStyle=p.skin;ctx.fillRect(cx-5,cy-8,10,10);
  // ears
  ctx.fillStyle=p.skin;ctx.fillRect(cx-6,cy-5,1,3);ctx.fillRect(cx+5,cy-5,1,3);
  // hair
  ctx.fillStyle=p.hair;
  if(p.woman){
    ctx.fillRect(cx-6,cy-9,12,4);ctx.fillRect(cx-6,cy-9,2,12);ctx.fillRect(cx+4,cy-9,2,12);
  } else if(p.balding){
    ctx.fillRect(cx-5,cy-9,4,3);ctx.fillRect(cx+1,cy-9,4,3);ctx.fillRect(cx-5,cy-9,2,4);ctx.fillRect(cx+3,cy-9,2,4);
  } else if(p.glasses){
    ctx.fillRect(cx-5,cy-9,4,3);ctx.fillRect(cx+1,cy-9,4,3);ctx.fillRect(cx-5,cy-9,2,6);ctx.fillRect(cx+3,cy-9,2,6);
  } else if(p.rolled){
    ctx.fillRect(cx-5,cy-9,10,4);ctx.fillRect(cx-6,cy-8,2,7);ctx.fillRect(cx+4,cy-8,2,6);ctx.fillRect(cx-4,cy-10,2,2);ctx.fillRect(cx+2,cy-10,2,2);
  } else if(p.mustache){
    // buzz cut
    ctx.fillRect(cx-5,cy-9,10,3);ctx.fillRect(cx-4,cy-9,8,2);
  } else {
    // slicked back
    ctx.fillRect(cx-5,cy-9,10,2);ctx.fillRect(cx-5,cy-9,2,5);ctx.fillRect(cx-4,cy-9,8,1);
  }
  // mustache
  if(p.mustache){ctx.fillStyle=p.hair;ctx.fillRect(cx-3,cy-3,6,2);}
  // eyes
  const stateT=performance.now()/1000;
  const blink=((stateT+(charIdx*.31))%4)<.14;
  ctx.fillStyle='#111';
  ctx.fillRect(cx-3,cy-4,1,blink?1:2);ctx.fillRect(cx+2,cy-4,1,blink?1:2);
  if(state==='sleeping'){ctx.fillStyle='#555';ctx.fillRect(cx-3,cy-4,2,1);ctx.fillRect(cx+2,cy-4,2,1);}
  // glasses
  if(p.glasses||p.glasses2){
    ctx.strokeStyle='#8a7a60';ctx.lineWidth=0.5;
    ctx.strokeRect(cx-4,cy-5,3,3);ctx.strokeRect(cx+1,cy-5,3,3);
    ctx.beginPath();ctx.moveTo(cx-1,cy-4);ctx.lineTo(cx+1,cy-4);ctx.stroke();
  }
  // mouth (state-based)
  ctx.fillStyle='#8a4a3a';
  if(state==='working'){ctx.fillRect(cx-2,cy-1,4,1);}
  else if(state==='idle'){ctx.fillRect(cx-1,cy-1,2,1);}
  else{ctx.fillRect(cx-1,cy,2,1);}
  // state dot badge
  const stC={working:'#34C759',idle:'#FF9F0A',sleeping:'#AEB1BB'};
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(W-5,H-5,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=stC[state]||'#ccc';ctx.beginPath();ctx.arc(W-5,H-5,2,0,Math.PI*2);ctx.fill();
}

// ── OFFICE ──
function renderOffice(){
  const d=DOMS[selDom];
  document.getElementById('canvasBadge').textContent=d.lbl;
  // Only active agents (working or idle)
  const activeAgents=d.agents.filter(a=>a.state==='working'||a.state==='idle');
  const total=d.agents.length;
  document.getElementById('canvasTxt').textContent=`${activeAgents.length} פעילים מתוך ${total}`;
  // Workflow — Thinking state panel, RTL Hebrew
  document.getElementById('wfList').innerHTML=(d.workflow.length?d.workflow:[]).map((w,i)=>{
    const isLast=i===d.workflow.length-1;
    const st=w.state==='working'?'running':(w.state==='idle'?'done':'pending');
    const icon=st==='done'?'✓':(st==='running'?'◉':'○');
    const rawAgent=w.cmd?w.cmd.split('.')[0]:'';
    const action=w.cmd&&w.cmd.includes('.')?w.cmd.split('.').slice(1).join('.'):''
    const runBar=st==='running'?`<div class="wf-running-bar"></div>`:'';
    const cursor=isLast&&st==='running'?`<span class="wf-cursor"></span>`:'';
    return`<div class="wf-item">
      <div class="wf-step-icon ${st}">${icon}</div>
      <div class="wf-step-content">
        <div class="wf-agent">${rawAgent?`<b>${rawAgent}</b>${action?' · '+action:''}`:w.cmd||''}</div>
        <div class="wf-out">${w.out||w.s||''}${cursor}</div>
        ${runBar}
        <span class="wf-state ${st}">${w.tag||''}</span>
      </div>
    </div>`;
  }).join('')||`<div class="wf-item"><div class="wf-step-icon running">◉</div><div class="wf-step-content"><div class="wf-out">מאתחל סוכנים...<span class="wf-cursor"></span></div></div></div>`;
  // Agents horizontal faces row — all agents (with state indicator)
  document.getElementById('agFacesRow').innerHTML=d.agents.map((a,i)=>{
    const ci=CHAR_MAP[i%CHAR_MAP.length];
    return`<div class="ag-face-slot" onclick="openAgSheet(${i})">
      <div class="ag-face-canvas ${a.state}" id="fc-${i}">
        <canvas id="fcc-${i}" width="96" height="96"></canvas>
      </div>
      <div class="ag-face-role">${a.role}</div>
    </div>`;
  }).join('');
  // Draw faces
  d.agents.forEach((a,i)=>{
    const cv=document.getElementById('fcc-'+i);
    if(cv) drawFace(cv, CHAR_MAP[i%CHAR_MAP.length], a.state);
  });
}

function openAgSheet(i){
  selAg=i;
  const d=DOMS[selDom];
  const a=d.agents[i];
  const ci=CHAR_MAP[i%CHAR_MAP.length];
  const stLbl={working:'עובד כעת 🟢',idle:'ממתין 🟡',sleeping:'ישן 🔘'};
  const stC={working:'#34C759',idle:'#D97706',sleeping:'#8E8E93'};
  document.getElementById('agSheetBody').innerHTML=`
    <div class="ags-top">
      <div class="ags-face"><canvas id="ags-face-cv" width="96" height="96" style="width:54px;height:54px;display:block;border-radius:14px;"></canvas></div>
      <div>
        <div class="ags-name">${a.name}</div>
        <div class="ags-role">${a.role}</div>
        <div class="ags-state" style="color:${stC[a.state]}">${stLbl[a.state]||a.state}</div>
      </div>
    </div>
    <div class="ags-section">
      <div class="ags-sec-lbl">אחריות ותפקיד</div>
      <div class="ags-sec-body">${a.desc}</div>
    </div>
    <div class="ags-section">
      <div class="ags-sec-lbl">לוז עבודה</div>
      <div class="ags-sched">🕐 ${a.sched}</div>
    </div>`;
  // Draw face in sheet
  const fcv=document.getElementById('ags-face-cv');
  if(fcv) drawFace(fcv, ci, a.state);
  document.getElementById('agSheet').classList.add('open');
}
function closeAgSheet(e){
  if(!e||e.target===document.getElementById('agSheet'))
    document.getElementById('agSheet').classList.remove('open');
}

// ── PIXEL-ART OFFICE CANVAS ──
// Character palettes per the design spec
// char_01: Strategist — dark brown slicked-back hair, charcoal-navy suit, light-blue shirt, blue-grey tie
// char_02: Finder/Scout — light brown curtain-bangs + glasses, mustard yellow shirt, brown striped tie
// char_03: Mentor/Coordinator — medium brown shaggy mop, light-blue rolled-up shirt, loose black tie
// char_04: Assistant/receptionist — strawberry-blonde half-up, pastel pink cardigan, white blouse
const OFF_P={
  p1:{skin:'#f1c27d',hair:'#3b2209',shirt:'#ddeaff',tie:'#6b83a8',pants:'#2c3448',suit:'#2e3448'},   // Michael Scott: dark brown slick, charcoal-navy suit
  p2:{skin:'#f5d5a8',hair:'#9b7a4a',shirt:'#f0c040',tie:'#7a5c30',pants:'#5a4a32',glasses:true},       // Dwight Schrute: curtain bangs, mustard shirt, glasses
  p3:{skin:'#ffdbac',hair:'#7a5030',shirt:'#b8d8f0',tie:'#1a1a1a',pants:'#c8b890',rolled:true},        // Jim Halpert: shaggy brown, light-blue rolled shirt
  p4:{skin:'#f6cfa6',hair:'#d4896a',shirt:'#f5f5f5',cardigan:'#dba8c8',woman:true},                    // Pam Beesly: strawberry blonde, pink cardigan
  p5:{skin:'#e8b88a',hair:'#2a1a0e',shirt:'#f8f8f8',tie:'#8a6a4a',pants:'#4a4040',suit:'#6a6258',balding:true},  // Kevin Malone: dark balding, grey-brown suit
  p6:{skin:'#8d5524',hair:'#1a1a1a',shirt:'#f8f8f8',tie:'#cc2222',pants:'#2a3060',suit:'#1e2a4a',mustache:true,glasses2:true},  // Stanley Hudson: dark skin, buzz+mustache, navy suit, red tie
};

// Map each agent slot (0-5) to a palette and animation role
// state → animation: working→typist, idle→phoneGuy, sleeping→sleeper
// Layout: 3 desks back row (ROW1), 3 desks front row (ROW2)
// Logical canvas 320×180, S=4 → physical 1280×720
const OFF_S=4;
// 3 rows × 2 desks — wall now at y=0 so rows shifted up by 12
const OFF_ROW1=80,OFF_ROW2=120,OFF_ROW3=162,OFF_DX=[52,192];
const OFF_C={
  wall:'#4d6283',wallD:'#3d4f6c',base:'#2a3448',
  fl1:'#cdb88c',fl2:'#c1ab7e',
  deskT:'#c28a52',deskF:'#93613a',deskD:'#74482a',
  mon:'#23262f',scr:'#123a58',scrL:'#5fe0ff',chair:'#2c2a3a'
};
const OFF_FONT='"Inter",system-ui,sans-serif';

let offT=0,offLast=0,offAnimId=null,offPops=[],offNextPop=1.5,offCount=0;

function sizeOff(){
  const box=document.getElementById('offWrap');
  const cv=document.getElementById('cvOff');
  if(!box||!cv) return;
  const W=box.offsetWidth,H=box.offsetHeight;
  if(!W||!H) return;
  // Use 16:9 logical 1280×720 for the pixel art engine
  cv.width=1280; cv.height=720;
  cv.style.width=W+'px'; cv.style.height=H+'px';
}

function drawOff(){
  cancelAnimationFrame(offAnimId);
  const cv=document.getElementById('cvOff');
  if(!cv) return;
  offLast=performance.now();
  const ctx=cv.getContext('2d');
  ctx.setTransform(OFF_S,0,0,OFF_S,0,0);
  ctx.imageSmoothingEnabled=false;
  const R=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)};

  function offDesk(dx,y){
    R(dx,y,60,4,OFF_C.deskT);R(dx,y+4,60,15,OFF_C.deskF);
    R(dx+2,y+6,56,1,OFF_C.deskD);R(dx+4,y+19,4,3,OFF_C.deskD);R(dx+52,y+19,4,3,OFF_C.deskD);
    R(dx+40,y+9,14,6,OFF_C.deskD);R(dx+46,y+11,2,1,OFF_C.deskT);
  }
  function offMonitor(mx,y,mode){
    R(mx+8,y-3,3,3,'#555');R(mx+5,y-1,9,1,'#555');R(mx,y-16,19,13,OFF_C.mon);R(mx+1,y-15,17,11,OFF_C.scr);
    if(mode==='type'){
      const n=Math.floor(offT*3)%9;
      for(let i=0;i<Math.min(n,5);i++){const w=4+((i*7+Math.floor(offT*3/9))%9);R(mx+2,y-14+i*2,Math.min(w,15),1,OFF_C.scrL);}
      if(Math.floor(offT*4)%2) R(mx+2+((n*3)%14),y-14+Math.min(n,4)*2,1,1,'#fff');
    } else if(mode==='saver'){
      const bx=Math.abs(((offT*9)%28)-14),by=Math.abs(((offT*6)%18)-9);R(mx+2+bx,y-14+by,2,2,'#ff6bd5');
    } else if(mode==='call'){
      R(mx+3,y-13,6,6,'#2e8bd1');R(mx+10,y-13,6,1,OFF_C.scrL);R(mx+10,y-11,5,1,OFF_C.scrL);R(mx+10,y-9,6,1,OFF_C.scrL);
    } else {
      R(mx+2,y-14,15,9,'#1d5d3a');R(mx+3,y-13,8,1,'#8ff0b0');R(mx+3,y-11,11,1,'#8ff0b0');R(mx+3,y-9,6,1,'#8ff0b0');
    }
  }
  function offHead(cx,hy,p,eyes){
    R(cx-5,hy,10,11,p.skin);
    if(p.woman){
      // strawberry blonde half-up: wide top, side tendrils
      R(cx-6,hy-1,12,4,p.hair);R(cx-6,hy-1,2,14,p.hair);R(cx+4,hy-1,2,14,p.hair);
      // cardigan collar hint
      R(cx+2,hy-2,3,2,'#dba8c8');
    } else if(p.glasses){
      // curtain bangs: center part
      R(cx-5,hy-1,4,3,p.hair);R(cx+1,hy-1,4,3,p.hair);R(cx-5,hy-1,2,5,p.hair);R(cx+3,hy-1,2,5,p.hair);
    } else if(p.rolled){
      // shaggy mop: bigger, messier
      R(cx-5,hy-1,10,4,p.hair);R(cx-6,hy,2,6,p.hair);R(cx+4,hy,2,5,p.hair);R(cx-4,hy-2,2,2,p.hair);R(cx+2,hy-2,2,2,p.hair);
    } else {
      // slicked-back: tight, smooth
      R(cx-5,hy-1,10,2,p.hair);R(cx-5,hy-1,2,4,p.hair);R(cx-4,hy-1,8,1,p.hair);
    }
    R(cx-6,hy+5,1,2,p.skin);R(cx+5,hy+5,1,2,p.skin);
    // glasses overlay
    if(p.glasses){ctx.strokeStyle='#8a7a60';ctx.lineWidth=0.5;ctx.strokeRect(cx-4,hy+4,4,3);ctx.strokeRect(cx+0,hy+4,4,3);}
    if(eyes==='closed'){R(cx-3,hy+5,2,1,'#222');R(cx+1,hy+5,2,1,'#222');}
    else if(eyes!=='none'){const blink=((offT+cx*.13)%4)<.12;R(cx-3,hy+5,1,blink?1:2,'#111');R(cx+2,hy+5,1,blink?1:2,'#111');}
  }
  function offTorso(cx,ty,p,h){
    const topC=p.cardigan||p.shirt;
    R(cx-7,ty,14,h,topC);
    if(p.cardigan){// blouse under cardigan: peek at collar
      R(cx-3,ty,6,2,p.shirt||'#fff');
    }
    if(p.tie){R(cx-1,ty,2,h-2,p.tie);}
    else if(!p.woman){R(cx-2,ty,4,2,p.skin);}
    if(p.suit){// suit jacket over shirt
      R(cx-7,ty,3,h,p.suit);R(cx+4,ty,3,h,p.suit);
    }
  }
  function offTypist(dx,y,p,speed){
    const cx=dx+20;
    R(cx-9,y-21,18,21,OFF_C.chair);
    offTorso(cx,y-13,p,13);offHead(cx,y-25,p);
    R(cx-1,y-17,2,1,'#8a4a3a');
    offDesk(dx,y);R(cx-8,y,16,2,'#e4e4ea');
    for(let i=0;i<7;i++) R(cx-7+i*2,y,1,1,'#b9b9c4');
    const a=Math.sin(offT*speed)>0?-1:0,b=Math.sin(offT*speed+1.7)>0?-1:0;
    R(cx-9,y-6,3,5,p.shirt||p.cardigan);R(cx+6,y-6,3,5,p.shirt||p.cardigan);
    R(cx-7,y-1+a,3,2,p.skin);R(cx+4,y-1+b,3,2,p.skin);
    offMonitor(dx+36,y,'type');
    R(dx+3,y-3,4,3,'#fff');R(dx+7,y-2,1,1,'#fff');R(dx+4,y-3,2,1,'#6b3a1a');
  }
  function offPhoneGuy(dx,y,p){
    const cx=dx+20;
    R(cx-9,y-21,18,21,OFF_C.chair);
    offTorso(cx,y-13,p,13);offHead(cx,y-25,p);
    const talk=Math.floor(offT*7)%3!==0&&(offT%5)<3.6;
    R(cx-1,y-17,2,talk?2:1,'#8a4a3a');
    R(cx-10,y-19,3,9,p.shirt||p.cardigan);R(cx-9,y-21,3,3,p.skin);
    R(cx-7,y-24,2,8,'#151515');R(cx-7,y-24,2,1,'#e74c3c');
    offDesk(dx,y);R(cx-8,y,16,2,'#e4e4ea');R(cx+5,y-1,3,2,p.skin);
    offMonitor(dx+36,y,'call');
    R(dx+4,y-4,6,4,'#d8d8d8');R(dx+5,y-6,4,2,'#d8d8d8');R(dx+6,y-7,2,1,'#c0392b');
  }
  function offSleeper(dx,y,p){
    const cx=dx+20,br=Math.round(Math.sin(offT*1.6)*0.8);
    R(cx-9,y-21,18,21,OFF_C.chair);
    offTorso(cx,y-10+br,p,10);
    offDesk(dx,y);R(cx-8,y,16,2,'#e4e4ea');
    R(cx-12,y-5,22,6,'#f6f6fb');R(cx-12,y,22,1,'#cfd0e0');
    R(cx-12,y-5,1,6,'#dcdcec');R(cx+9,y-5,1,6,'#dcdcec');
    R(cx-11,y-4,3,3,p.shirt||p.cardigan);R(cx+6,y-4,3,3,p.shirt||p.cardigan);
    offHead(cx-1,y-13+br,p,'closed');R(cx-2,y-6+br,2,1,'#8a4a3a');
    if(((offT%3)<1.5)) R(cx-3,y-5+br,1,2,'#9bd8ff');
    offMonitor(dx+36,y,'saver');
    for(let i=0;i<3;i++){
      const ph=(offT*0.55+i/3)%1;
      ctx.globalAlpha=1-ph;ctx.fillStyle='#ffffff';
      ctx.font=`700 ${5+i*1.5}px ${OFF_FONT}`;
      ctx.fillText('Z',cx+4+ph*10+i*2,y-18-ph*16-i*3);
    }
    ctx.globalAlpha=1;
  }
  // Animated 3-dot talking bubble (no text)
  function offBubble(x,y){
    const bw=16,bh=10;
    let bx=Math.round(x-bw/2);bx=Math.max(3,Math.min(317-bw,bx));const by=Math.round(y-bh-2);
    ctx.fillStyle='#fff';
    ctx.beginPath();
    const r=2;
    ctx.moveTo(bx+r,by);ctx.lineTo(bx+bw-r,by);ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+r);
    ctx.lineTo(bx+bw,by+bh-r);ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-r,by+bh);
    ctx.lineTo(bx+4,by+bh);ctx.lineTo(bx+2,by+bh+3);ctx.lineTo(bx+2,by+bh);
    ctx.lineTo(bx+r,by+bh);ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-r);
    ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=0.5;ctx.stroke();
    // 3 animated dots
    const phase=offT*3;
    for(let d=0;d<3;d++){
      const bounce=Math.sin(phase+d*1.1)*1.5;
      const cx2=bx+4+d*5;const cy2=by+bh/2-bounce;
      ctx.fillStyle='#888';ctx.beginPath();ctx.arc(cx2,cy2,1.2,0,Math.PI*2);ctx.fill();
    }
  }

  function offRoom(d){
    // Wall starts at y=0 — full canvas, no HUD bar
    R(0,0,320,58,OFF_C.wall);
    for(let x=0;x<320;x+=8) R(x,0,1,58,OFF_C.wallD);
    R(0,46,320,8,OFF_C.wallD);R(0,54,320,3,OFF_C.base);
    for(let y=57;y<180;y+=12) for(let x=0;x<320;x+=12) R(x,y,12,12,((x+y)/12)%2?OFF_C.fl1:OFF_C.fl2);
    // windows
    offWin(14,8,50,30);offWin(258,8,50,30);
    // wall clock
    const ccx=150,ccy=22;
    R(ccx-9,ccy-9,18,18,'#222');R(ccx-8,ccy-8,16,16,'#fafafa');
    const gm=9*60+Math.floor(offT);
    ctx.strokeStyle='#222';ctx.lineWidth=1;ctx.beginPath();
    const ha=((gm/60)%12)/12*Math.PI*2,ma=(gm%60)/60*Math.PI*2;
    ctx.moveTo(ccx,ccy);ctx.lineTo(ccx+Math.sin(ha)*4,ccy-Math.cos(ha)*4);
    ctx.moveTo(ccx,ccy);ctx.lineTo(ccx+Math.sin(ma)*6.5,ccy-Math.cos(ma)*6.5);
    ctx.stroke();
    // poster — domain color block, no text
    R(186,10,52,30,'#1d2740');R(188,12,48,26,d.color);
    // whiteboard — only bar chart
    R(76,10,52,30,'#e9edf2');R(76,10,52,2,'#9aa4b3');
    const bars=[d.prog*0.18,14,d.prog*0.12,d.prog*0.16];
    const barC=[d.color,'#4a90d9','#2ecc71','#e67e22'];
    bars.forEach((bh,bi)=>{R(80+bi*11,32-Math.round(bh),8,Math.round(bh),barC[bi]);});
    R(78,32,48,1,'#555');
    // water cooler + plant (shifted to freed right area — standing agents moved)
    R(4,124,14,30,'#d6dde6');R(4,124,14,2,'#aab4c0');R(6,108,10,16,'#7cc8f5');R(7,110,3,10,'#b6e3ff');R(10,134,3,2,'#3a6ea5');
    R(300,140,12,14,'#a0522d');R(300,140,12,2,'#7a3e20');
    const sw=Math.round(Math.sin(offT*1.2));
    R(302+sw,124,3,16,'#2f8f46');R(306,120,3,20,'#3faa55');R(298+sw,128,4,4,'#3faa55');R(309-sw,126,4,4,'#2f8f46');
  }
  function offWin(x,y,w,h){
    R(x-2,y-2,w+4,h+4,'#e8edf3');R(x,y,w,h,'#7ec8ff');R(x,y+h-8,w,8,'#a9dcff');
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    for(let i=0;i<2;i++){const cx2=x+((offT*3+i*37+x)%(w+30))-15;R(cx2,y+6+i*9,12,3,'#fff');R(cx2+3,y+4+i*9,6,2,'#fff');}
    R(x+6,y+h-12,8,12,'#5b6b84');R(x+18,y+h-17,10,17,'#4b5a72');R(x+32,y+h-10,7,10,'#5b6b84');
    ctx.restore();
    R(x+w/2-1,y,2,h,'#e8edf3');R(x,y+h/2-1,w,2,'#e8edf3');
  }
  function offStanding(cx,fy,p,face,gesture){
    const pants=p.pants||'#2b2f45';
    R(cx-5,fy-12,4,12,pants);R(cx+1,fy-12,4,12,pants);
    R(cx-6,fy-1,5,2,'#111');R(cx+1,fy-1,5,2,'#111');
    offTorso(cx,fy-26,p,15);offHead(cx,fy-37,p);
    R(cx-1+face,fy-29,2,gesture?2:1,'#8a4a3a');
    const up=gesture&&Math.sin(offT*5)>0;
    if(face<0){
      R(cx-9,fy-25-(up?5:0),3,up?7:10,p.shirt||p.cardigan);
      R(cx-9,fy-(up?20:15),3,3,p.skin);
      R(cx+6,fy-25,3,10,p.shirt||p.cardigan);R(cx+6,fy-15,3,3,p.skin);
    } else {
      R(cx-9,fy-25,3,10,p.shirt||p.cardigan);R(cx-9,fy-15,3,3,p.skin);
      R(cx+6,fy-25,3,10,p.shirt||p.cardigan);R(cx+6,fy-15,3,3,p.skin);
    }
  }

  function offFrame(){
    const now=performance.now();
    const dt=Math.min(0.1,(now-offLast)/1000);offLast=now;
    offT+=dt;
    offNextPop-=dt;
    if(offNextPop<=0){
      offCount++;offNextPop=2+Math.random()*2.5;
      const spots=[[OFF_DX[0]+20,OFF_ROW1-30],[OFF_DX[1]+20,OFF_ROW2-30],[OFF_DX[0]+20,OFF_ROW3-30]];
      const s=spots[Math.floor(Math.random()*3)];
      offPops.push({x:s[0],y:s[1],age:0});
    }
    offPops.forEach(p=>p.age+=dt);
    offPops=offPops.filter(p=>p.age<1.4);

    ctx.clearRect(0,0,320,180);
    const d=DOMS[selDom];
    offRoom(d);

    // 6 desk positions — 3 rows × 2 columns, depth order back→front
    const allPositions=[
      {dx:OFF_DX[0],y:OFF_ROW1},{dx:OFF_DX[1],y:OFF_ROW1},
      {dx:OFF_DX[0],y:OFF_ROW2},{dx:OFF_DX[1],y:OFF_ROW2},
      {dx:OFF_DX[0],y:OFF_ROW3},{dx:OFF_DX[1],y:OFF_ROW3}
    ];
    const allPalettes=[OFF_P.p1,OFF_P.p2,OFF_P.p3,OFF_P.p4,OFF_P.p5,OFF_P.p6];
    const speeds=[22,26,18,24,20,28];
    const agents=d.agents;

    // Draw rows back→front, skip sleeping agents (empty desk drawn instead)
    [0,1, 2,3, 4,5].forEach(i=>{
      if(i>=agents.length) return;
      const ag=agents[i];
      const pos=allPositions[i];
      const pal=allPalettes[i];
      if(ag.state==='sleeping'){offSleeper(pos.dx,pos.y,pal);return;}
      if(ag.state==='working'){offTypist(pos.dx,pos.y,pal,speeds[i]);offBubble(pos.dx+6,pos.y-48);}
      else offPhoneGuy(pos.dx,pos.y,pal);
    });

    // Floating score pops
    for(const p of offPops){
      const k=p.age/1.4;
      ctx.globalAlpha=1-k;ctx.fillStyle=d.color;
      ctx.font=`700 6px ${OFF_FONT}`;ctx.direction='rtl';ctx.textAlign='center';
      ctx.fillText('+1',p.x,p.y-k*14);
    }
    ctx.globalAlpha=1;ctx.direction='ltr';ctx.textAlign='left';

    offAnimId=requestAnimationFrame(offFrame);
  }

  offFrame();
}

