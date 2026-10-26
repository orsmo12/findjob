'use client'
import { useState, useEffect, useRef } from 'react'
import type { Page } from '@/components/layout/Sidebar'

type AgentState = 'working' | 'idle' | 'sleeping'

interface Agent {
  id: string; name: string; role: string; emoji: string; color: string;
  state: AgentState; desc: string; sched: string;
}

const AGENTS: Agent[] = [
  { id:'manager',      name:'מנהל',      role:'אסטרטגיה וסיכום',    emoji:'🎯', color:'#6366f1',
    state:'working',  desc:'מנהל את תהליך חיפוש העבודה — מגדיר אסטרטגיה, מתאם בין הסוכנים ומספק סיכום יומי.', sched:'פועל בכל הרצת pipeline' },
  { id:'profile',      name:'פרופיל',    role:'ניתוח CV ו-LinkedIn', emoji:'👤', color:'#ec4899',
    state:'idle',     desc:'מנתח את קורות החיים ופרופיל LinkedIn — מזהה חוזקות, פערים ומיקום בשוק.', sched:'מופעל עם העלאת CV' },
  { id:'finder',       name:'מחפש',      role:'חיפוש משרות',         emoji:'🔍', color:'#06b6d4',
    state:'working',  desc:'סורק LinkedIn, Indeed ו-Glassdoor — מוצא משרות רלוונטיות ומסנן לפי פרופיל.', sched:'כל 6 שעות' },
  { id:'market_scout', name:'חוקר שוק',  role:'מחקר חברות',          emoji:'🕵️', color:'#8b5cf6',
    state:'idle',     desc:'חוקר חברות מפורסמות — אוסף מידע על תרבות, טכנולוגיה וסיכויי קבלה.', sched:'בכל pipeline' },
  { id:'mentor',       name:'מנטור',     role:'ייעוץ ומכתבים',       emoji:'🧭', color:'#10b981',
    state:'sleeping', desc:'מכין מכתבי מוטיבציה, חומרי הכנה לראיונות ומייעץ על התקדמות הקריירה.', sched:'לפי דרישה' },
]

// Character palettes (Office cast style from Life Building artifact)
const CHARS = [
  {skin:'#f1c27d',hair:'#3b2209',shirt:'#ddeaff',tie:'#6f83a8',suit:'#2e3448'},
  {skin:'#f5d5a8',hair:'#9b7a4a',shirt:'#f0c040',tie:'#7a5c30',glasses:true},
  {skin:'#ffdbac',hair:'#7a5030',shirt:'#b8d8f0',tie:'#1a1a1a',rolled:true},
  {skin:'#f6cfa6',hair:'#d4896a',shirt:'#f5f5f5',cardigan:'#dba8c8',woman:true},
  {skin:'#e8b88a',hair:'#2a1a0e',shirt:'#f8f8f8',tie:'#8a6a4a',suit:'#6a6258',balding:true},
] as any[]

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --bg: #EEF0F8;
  --surf: #FFFFFF;
  --surf2: #E8EBF5;
  --fg: #1A1A2E;
  --fg2: #5A5A7A;
  --fg3: #9999BB;
  --accent: #5B6CF9;
  --accent-lt: #EEF0FE;
  --brd: #DDE0EE;
  --r: 18px;
  --r-sm: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.office-root {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
  min-height: 100dvh;
  max-width: 430px;
  margin: 0 auto;
  direction: rtl;
  overflow-x: hidden;
  position: relative;
}

/* ── TOP BAR ── */
.office-topbar {
  position: sticky; top: 0; z-index: 30;
  background: var(--surf);
  border-bottom: 1px solid var(--brd);
  padding: 12px 16px 10px;
  display: flex; align-items: center; gap: 10px;
}
.office-topbar-back {
  width: 32px; height: 32px; border-radius: 10px;
  background: var(--surf2); border: none; cursor: pointer;
  font-size: 16px; display: flex; align-items: center; justify-content: center;
}
.office-topbar-title { font-size: 16px; font-weight: 700; color: var(--fg); flex: 1; }
.office-topbar-badge {
  background: var(--accent-lt); color: var(--accent);
  border-radius: 8px; padding: 3px 8px;
  font-size: 11px; font-weight: 600;
}

/* ── CANVAS SECTION ── */
.office-canvas-wrap {
  margin: 12px 12px 0;
  border-radius: var(--r);
  overflow: hidden;
  position: relative;
  background: #1d2740;
  aspect-ratio: 16/9;
}
.office-canvas-badge {
  position: absolute; top: 10px; right: 10px; z-index: 5;
  background: rgba(0,0,0,0.45); color: rgba(255,255,255,0.9);
  border-radius: 8px; padding: 3px 10px;
  font-size: 10px; font-weight: 600;
  backdrop-filter: blur(4px);
}
.office-canvas-count {
  position: absolute; bottom: 10px; left: 10px; z-index: 5;
  background: rgba(0,0,0,0.45); color: rgba(255,255,255,0.75);
  border-radius: 8px; padding: 2px 8px; font-size: 10px;
  backdrop-filter: blur(4px);
}
#cvOff {
  width: 100%; height: 100%;
  image-rendering: pixelated;
  display: block;
}

/* ── WORKFLOW PANEL ── */
.office-workflow {
  margin: 10px 12px 0;
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
}
.office-workflow-title {
  font-size: 12px; font-weight: 700; color: var(--fg2);
  margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
}
.wf-item {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 7px 0; border-bottom: 1px solid var(--brd);
}
.wf-item:last-child { border-bottom: none; }
.wf-step-icon {
  width: 20px; height: 20px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
  margin-top: 1px;
}
.wf-step-icon.done { background: rgba(52,199,89,0.15); color: #34C759; }
.wf-step-icon.running { background: rgba(91,108,249,0.15); color: var(--accent); }
.wf-step-icon.pending { background: var(--surf2); color: var(--fg3); }
.wf-step-content { flex: 1; min-width: 0; }
.wf-agent { font-size: 12px; color: var(--fg); font-weight: 600; }
.wf-out { font-size: 11px; color: var(--fg2); margin-top: 2px; line-height: 1.4; }
.wf-state { font-size: 10px; font-weight: 600; margin-top: 3px; display: inline-block; }
.wf-state.done { color: #34C759; }
.wf-state.running { color: var(--accent); }
.wf-state.pending { color: var(--fg3); }
.wf-cursor { display: inline-block; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.wf-running-bar {
  height: 2px; background: var(--accent);
  border-radius: 1px; margin-top: 4px;
  animation: wfrun 1.5s ease infinite;
  width: 60%;
}
@keyframes wfrun { 0%,100%{width:20%} 50%{width:70%} }

/* ── AGENT FACES ROW ── */
.office-faces-section {
  margin: 10px 12px 0;
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
}
.office-faces-title {
  font-size: 12px; font-weight: 700; color: var(--fg2); margin-bottom: 12px;
}
.ag-faces-row {
  display: flex; gap: 10px;
  overflow-x: auto; scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}
.ag-faces-row::-webkit-scrollbar { display: none; }
.ag-face-slot {
  flex: 0 0 72px; text-align: center; cursor: pointer;
}
.ag-face-canvas {
  width: 48px; height: 48px;
  border-radius: 14px; overflow: hidden;
  margin: 0 auto 5px;
  border: 2px solid transparent;
  transition: border-color 0.2s, transform 0.15s;
}
.ag-face-canvas:active { transform: scale(0.93); }
.ag-face-canvas.working { border-color: #34C759; }
.ag-face-canvas.idle { border-color: #FF9F0A; }
.ag-face-canvas.sleeping { border-color: var(--fg3); }
.ag-face-name { font-size: 10px; font-weight: 600; color: var(--fg2); }
.ag-face-state {
  font-size: 9px; color: var(--fg3); margin-top: 1px;
}

/* ── AGENT CARDS ── */
.office-agents-section {
  margin: 10px 12px 0; padding-bottom: 20px;
}
.agent-card {
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: transform 0.15s;
  border: 1px solid var(--brd);
}
.agent-card:active { transform: scale(0.98); }
.agent-card-top {
  display: flex; gap: 12px; align-items: flex-start;
}
.agent-card-av {
  width: 48px; height: 48px;
  border-radius: 14px; overflow: hidden;
  flex-shrink: 0; position: relative;
}
.agent-state-dot {
  position: absolute; bottom: 2px; right: 2px;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--surf);
}
.agent-card-info { flex: 1; }
.agent-card-name { font-size: 14px; font-weight: 700; color: var(--fg); }
.agent-card-role { font-size: 11px; color: var(--fg2); margin-top: 2px; }
.agent-card-state-lbl {
  font-size: 10px; font-weight: 600; margin-top: 4px;
}
.agent-card-desc { font-size: 11px; color: var(--fg3); margin-top: 8px; line-height: 1.5; }
.agent-card-sched {
  font-size: 10px; color: var(--fg3); margin-top: 6px;
  display: flex; align-items: center; gap: 4px;
}

/* ── AGENT SHEET ── */
.ag-sheet-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(26,26,46,0.45);
  display: flex; align-items: flex-end;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.ag-sheet-overlay.open { opacity: 1; pointer-events: all; }
.ag-sheet {
  width: 100%; max-width: 430px; margin: 0 auto;
  background: var(--surf);
  border-radius: var(--r) var(--r) 0 0;
  padding: 20px 16px 40px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}
.ag-sheet-overlay.open .ag-sheet { transform: translateY(0); }
.ag-sheet-handle {
  width: 36px; height: 4px; background: var(--brd);
  border-radius: 2px; margin: 0 auto 16px;
}
.ags-top {
  display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px;
}
.ags-face {
  width: 54px; height: 54px;
  border-radius: 14px; overflow: hidden; flex-shrink: 0;
}
.ags-name { font-size: 17px; font-weight: 700; color: var(--fg); }
.ags-role { font-size: 12px; color: var(--fg2); margin-top: 3px; }
.ags-state { font-size: 12px; font-weight: 600; margin-top: 5px; }
.ags-section { margin-bottom: 14px; }
.ags-sec-lbl { font-size: 11px; font-weight: 700; color: var(--fg3); margin-bottom: 5px; }
.ags-sec-body { font-size: 12px; color: var(--fg2); line-height: 1.6; }
.ags-sched { font-size: 12px; color: var(--fg2); }

.scroll-content { padding-bottom: 20px; }
`

function drawFace(canvas: HTMLCanvasElement, charIdx: number, state: string) {
  canvas.width = 96; canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const S = 3
  ctx.setTransform(S,0,0,S,0,0)
  ctx.imageSmoothingEnabled = false
  const W=32, H=32, cx=16, cy=20
  const p = CHARS[charIdx % CHARS.length]
  const R = (x:number,y:number,w:number,h:number,c:string) => { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),w,h) }
  R(0,0,W,H,'#E8EBF5')
  const topC = (p as any).cardigan||p.shirt
  R(cx-6,cy+5,12,10,topC)
  if((p as any).suit){R(cx-6,cy+5,3,10,(p as any).suit);R(cx+3,cy+5,3,10,(p as any).suit)}
  if((p as any).cardigan){R(cx-2,cy+5,4,3,p.shirt)}
  if(p.tie){R(cx-1,cy+5,2,8,p.tie)}
  R(cx-2,cy+3,4,4,p.skin)
  R(cx-5,cy-8,10,10,p.skin)
  R(cx-6,cy-5,1,3,p.skin); R(cx+5,cy-5,1,3,p.skin)
  if((p as any).woman){ R(cx-6,cy-9,12,4,p.hair);R(cx-6,cy-9,2,12,p.hair);R(cx+4,cy-9,2,12,p.hair) }
  else if((p as any).balding){ R(cx-5,cy-9,4,3,p.hair);R(cx+1,cy-9,4,3,p.hair) }
  else if((p as any).glasses){ R(cx-5,cy-9,4,3,p.hair);R(cx+1,cy-9,4,3,p.hair);R(cx-5,cy-9,2,6,p.hair);R(cx+3,cy-9,2,6,p.hair) }
  else if((p as any).rolled){ R(cx-5,cy-9,10,4,p.hair);R(cx-6,cy-8,2,7,p.hair);R(cx+4,cy-8,2,6,p.hair) }
  else { R(cx-5,cy-9,10,2,p.hair);R(cx-5,cy-9,2,5,p.hair) }
  const t = performance.now()/1000
  const blink = ((t+(charIdx*.31))%4)<.14
  R(cx-3,cy-4,1,blink?1:2,'#111'); R(cx+2,cy-4,1,blink?1:2,'#111')
  if(state==='sleeping'){R(cx-3,cy-4,2,1,'#555');R(cx+2,cy-4,2,1,'#555')}
  if((p as any).glasses){ ctx.strokeStyle='#8a7a60';ctx.lineWidth=0.5;ctx.strokeRect(cx-4,cy-5,3,3);ctx.strokeRect(cx+1,cy-5,3,3) }
  if(state==='working'){R(cx-2,cy-1,4,1,'#8a4a3a')} else {R(cx-1,cy-1,2,1,'#8a4a3a')}
  const stC:any = {working:'#34C759',idle:'#FF9F0A',sleeping:'#AEB1BB'}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(W-5,H-5,3,0,Math.PI*2);ctx.fill()
  ctx.fillStyle=stC[state]||'#ccc';ctx.beginPath();ctx.arc(W-5,H-5,2,0,Math.PI*2);ctx.fill()
}

function AgentFace({ charIdx, state, size=48 }: { charIdx: number; state: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if(ref.current) drawFace(ref.current, charIdx, state) }, [charIdx, state])
  return <canvas ref={ref} style={{width:size,height:size,imageRendering:'pixelated',display:'block'}} />
}

// ── PIXEL-ART OFFICE CANVAS (full room, animated) ──
const OFF_P = [
  {skin:'#f1c27d',hair:'#3b2209',shirt:'#ddeaff',tie:'#6f83a8',pants:'#2c3448',suit:'#2e3448'},
  {skin:'#f5d5a8',hair:'#9b7a4a',shirt:'#f0c040',tie:'#7a5c30',pants:'#5a4a32',glasses:true},
  {skin:'#ffdbac',hair:'#7a5030',shirt:'#b8d8f0',tie:'#1a1a1a',pants:'#c8b890',rolled:true},
  {skin:'#f6cfa6',hair:'#d4896a',shirt:'#f5f5f5',cardigan:'#dba8c8',woman:true},
  {skin:'#e8b88a',hair:'#2a1a0e',shirt:'#f8f8f8',tie:'#8a6a4a',pants:'#4a4040',suit:'#6a6258',balding:true},
] as any[]

const OFF_C = {
  wall:'#4d6283', wallD:'#3d4f6c', base:'#2a3448',
  fl1:'#cdb88c', fl2:'#c1ab7e',
  deskT:'#c28a52', deskF:'#93613a', deskD:'#74482a',
  mon:'#23262f', scr:'#123a58', scrL:'#5fe0ff', chair:'#2c2a3a'
}

function drawOffice(canvas: HTMLCanvasElement, tRef: React.MutableRefObject<number>, agents: Agent[], accentColor: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const S = 4
  ctx.setTransform(S,0,0,S,0,0)
  ctx.imageSmoothingEnabled = false
  const t = tRef.current
  const R = (x:number,y:number,w:number,h:number,c:string) => { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),w,h) }

  const DX = [52, 192]
  const ROWS = [80, 120, 162]

  function desk(dx:number,y:number){
    R(dx,y,60,4,OFF_C.deskT);R(dx,y+4,60,15,OFF_C.deskF)
    R(dx+2,y+6,56,1,OFF_C.deskD);R(dx+4,y+19,4,3,OFF_C.deskD);R(dx+52,y+19,4,3,OFF_C.deskD)
  }
  function monitor(mx:number,y:number,mode:string){
    R(mx+8,y-3,3,3,'#555');R(mx+5,y-1,9,1,'#555');R(mx,y-16,19,13,OFF_C.mon);R(mx+1,y-15,17,11,OFF_C.scr)
    if(mode==='type'){
      const n=Math.floor(t*3)%9
      for(let i=0;i<Math.min(n,5);i++){R(mx+2,y-14+i*2,Math.min(4+(i*7+Math.floor(t*3/9))%9,15),1,OFF_C.scrL)}
      if(Math.floor(t*4)%2) R(mx+2+((n*3)%14),y-14+Math.min(n,4)*2,1,1,'#fff')
    } else if(mode==='saver'){
      const bx=Math.abs(((t*9)%28)-14),by=Math.abs(((t*6)%18)-9);R(mx+2+bx,y-14+by,2,2,'#ff6bd5')
    } else {
      R(mx+2,y-14,15,9,'#1d5d3a');R(mx+3,y-13,8,1,'#8ff0b0');R(mx+3,y-11,11,1,'#8ff0b0')
    }
  }
  function head(cx2:number,hy:number,p:any){
    R(cx2-5,hy,10,11,p.skin)
    if(p.woman){R(cx2-6,hy-1,12,4,p.hair);R(cx2-6,hy-1,2,14,p.hair);R(cx2+4,hy-1,2,14,p.hair)}
    else if(p.glasses){R(cx2-5,hy-1,4,3,p.hair);R(cx2+1,hy-1,4,3,p.hair);R(cx2-5,hy-1,2,5,p.hair);R(cx2+3,hy-1,2,5,p.hair)}
    else if(p.rolled){R(cx2-5,hy-1,10,4,p.hair);R(cx2-6,hy,2,6,p.hair);R(cx2+4,hy,2,5,p.hair)}
    else{R(cx2-5,hy-1,10,2,p.hair);R(cx2-5,hy-1,2,4,p.hair)}
    R(cx2-6,hy+5,1,2,p.skin);R(cx2+5,hy+5,1,2,p.skin)
    if(p.glasses){ctx.strokeStyle='#8a7a60';ctx.lineWidth=0.5;ctx.strokeRect(cx2-4,hy+4,4,3);ctx.strokeRect(cx2+0,hy+4,4,3)}
    const blink=((t+cx2*.13)%4)<.12
    R(cx2-3,hy+5,1,blink?1:2,'#111');R(cx2+2,hy+5,1,blink?1:2,'#111')
  }
  function torso(cx2:number,ty:number,p:any,h:number){
    const topC=p.cardigan||p.shirt
    R(cx2-7,ty,14,h,topC)
    if(p.cardigan){R(cx2-3,ty,6,2,p.shirt||'#fff')}
    if(p.tie){R(cx2-1,ty,2,h-2,p.tie)}
    if(p.suit){R(cx2-7,ty,3,h,p.suit);R(cx2+4,ty,3,h,p.suit)}
  }
  function typist(dx:number,y:number,p:any,speed:number){
    const cx2=dx+20
    R(cx2-9,y-21,18,21,OFF_C.chair)
    torso(cx2,y-13,p,13);head(cx2,y-25,p)
    R(cx2-1,y-17,2,1,'#8a4a3a')
    desk(dx,y);R(cx2-8,y,16,2,'#e4e4ea')
    const a=Math.sin(t*speed)>0?-1:0,b=Math.sin(t*speed+1.7)>0?-1:0
    R(cx2-9,y-6,3,5,p.shirt||p.cardigan);R(cx2+6,y-6,3,5,p.shirt||p.cardigan)
    R(cx2-7,y-1+a,3,2,p.skin);R(cx2+4,y-1+b,3,2,p.skin)
    monitor(dx+36,y,'type')
  }
  function phoneguy(dx:number,y:number,p:any){
    const cx2=dx+20
    R(cx2-9,y-21,18,21,OFF_C.chair)
    torso(cx2,y-13,p,13);head(cx2,y-25,p)
    R(cx2-1,y-17,2,1,'#8a4a3a')
    desk(dx,y);R(cx2-8,y,16,2,'#e4e4ea');R(cx2+5,y-1,3,2,p.skin)
    monitor(dx+36,y,'call')
  }
  function sleeper(dx:number,y:number,p:any){
    const cx2=dx+20,br=Math.round(Math.sin(t*1.6)*.8)
    R(cx2-9,y-21,18,21,OFF_C.chair)
    torso(cx2,y-10+br,p,10)
    desk(dx,y);R(cx2-8,y,16,2,'#e4e4ea')
    R(cx2-12,y-5,22,6,'#f6f6fb');R(cx2-12,y,22,1,'#cfd0e0')
    R(cx2-11,y-4,3,3,p.shirt||p.cardigan);R(cx2+6,y-4,3,3,p.shirt||p.cardigan)
    head(cx2-1,y-13+br,p)
    if((t%3)<1.5) R(cx2-3,y-5+br,1,2,'#9bd8ff')
    monitor(dx+36,y,'saver')
    for(let i=0;i<3;i++){
      const ph=(t*.55+i/3)%1
      ctx.globalAlpha=1-ph;ctx.fillStyle='#fff'
      ctx.font=`700 ${5+i*1.5}px Inter,sans-serif`;ctx.direction='rtl';ctx.textAlign='center'
      ctx.fillText('Z',cx2+4+ph*10+i*2,y-18-ph*16-i*3)
    }
    ctx.globalAlpha=1;ctx.direction='ltr';ctx.textAlign='left'
  }
  function bubble(bx:number,by:number){
    const bw=14,bh=9
    let ox=Math.round(bx-bw/2);ox=Math.max(3,Math.min(317-bw,ox));const oy=Math.round(by-bh-2)
    ctx.fillStyle='#fff'
    ctx.beginPath()
    ctx.moveTo(ox+2,oy);ctx.lineTo(ox+bw-2,oy);ctx.quadraticCurveTo(ox+bw,oy,ox+bw,oy+2)
    ctx.lineTo(ox+bw,oy+bh-2);ctx.quadraticCurveTo(ox+bw,oy+bh,ox+bw-2,oy+bh)
    ctx.lineTo(ox+4,oy+bh);ctx.lineTo(ox+2,oy+bh+3);ctx.lineTo(ox+2,oy+bh)
    ctx.lineTo(ox+2,oy+bh);ctx.quadraticCurveTo(ox,oy+bh,ox,oy+bh-2)
    ctx.lineTo(ox,oy+2);ctx.quadraticCurveTo(ox,oy,ox+2,oy);ctx.closePath();ctx.fill()
    ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=0.5;ctx.stroke()
    const phase=t*3
    for(let d=0;d<3;d++){
      const bounce=Math.sin(phase+d*1.1)*1.2
      const cx3=ox+3+d*4;const cy3=oy+bh/2-bounce
      ctx.fillStyle='#888';ctx.beginPath();ctx.arc(cx3,cy3,1,0,Math.PI*2);ctx.fill()
    }
  }

  // Clear
  ctx.clearRect(0,0,320,180)
  // Wall
  R(0,0,320,58,OFF_C.wall)
  for(let x=0;x<320;x+=8) R(x,0,1,58,OFF_C.wallD)
  R(0,46,320,8,OFF_C.wallD);R(0,54,320,3,OFF_C.base)
  // Floor tiles
  for(let y=57;y<180;y+=12) for(let x=0;x<320;x+=12) R(x,y,12,12,((x+y)/12)%2?OFF_C.fl1:OFF_C.fl2)
  // Windows
  ;[14,258].forEach(wx=>{
    R(wx-2,6,54,34,'#e8edf3');R(wx,8,50,30,'#7ec8ff');R(wx,30,50,8,'#a9dcff')
    R(wx+25,8,2,30,'#e8edf3');R(wx,23,50,2,'#e8edf3')
  })
  // Clock
  R(141,13,18,18,'#222');R(142,14,16,16,'#fafafa')
  const gm=9*60+Math.floor(t);ctx.strokeStyle='#222';ctx.lineWidth=1;ctx.beginPath()
  const ha=((gm/60)%12)/12*Math.PI*2,ma=(gm%60)/60*Math.PI*2
  ctx.moveTo(150,22);ctx.lineTo(150+Math.sin(ha)*4,22-Math.cos(ha)*4)
  ctx.moveTo(150,22);ctx.lineTo(150+Math.sin(ma)*6.5,22-Math.cos(ma)*6.5);ctx.stroke()
  // Poster
  R(186,10,52,30,'#1d2740');R(188,12,48,26,accentColor as any)
  // Water cooler
  R(4,124,14,30,'#d6dde6');R(4,124,14,2,'#aab4c0');R(6,108,10,16,'#7cc8f5')

  // Draw desks (3 rows × 2 cols = 6 max, we have 5 agents)
  const positions = [
    {dx:DX[0],y:ROWS[0]},{dx:DX[1],y:ROWS[0]},
    {dx:DX[0],y:ROWS[1]},{dx:DX[1],y:ROWS[1]},
    {dx:DX[0],y:ROWS[2]},
  ]
  const speeds = [22,26,18,24,20]
  agents.slice(0,5).forEach((ag,i)=>{
    const pos = positions[i]
    const pal = OFF_P[i]
    if(ag.state==='sleeping'){ sleeper(pos.dx,pos.y,pal); return }
    if(ag.state==='working'){ typist(pos.dx,pos.y,pal,speeds[i]); bubble(pos.dx+6,pos.y-48) }
    else { phoneguy(pos.dx,pos.y,pal) }
  })
}

export default function AgentOfficePage({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const [agents, setAgents] = useState<Agent[]>(AGENTS)
  const [selectedAgent, setSelectedAgent] = useState<Agent|null>(null)
  const cvRef = useRef<HTMLCanvasElement>(null)
  const tRef = useRef(0)
  const lastRef = useRef(0)
  const animRef = useRef<number>(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetFaceRef = useRef<HTMLCanvasElement>(null)

  // Animate office canvas
  useEffect(() => {
    function sizeCanvas() {
      const cv = cvRef.current; const wrap = wrapRef.current
      if (!cv || !wrap) return
      cv.width = 1280; cv.height = 720
      cv.style.width = wrap.offsetWidth+'px'
      cv.style.height = wrap.offsetHeight+'px'
    }
    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)

    function frame() {
      const now = performance.now()
      const dt = Math.min(0.1,(now-lastRef.current)/1000)
      lastRef.current = now
      tRef.current += dt
      const cv = cvRef.current
      if (cv) {
        const ctx = cv.getContext('2d')
        if (ctx) {
          ctx.setTransform(1,0,0,1,0,0)
          drawOffice(cv, tRef, agents, '#5B6CF9')
        }
      }
      animRef.current = requestAnimationFrame(frame)
    }
    lastRef.current = performance.now()
    animRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', sizeCanvas)
    }
  }, [agents])

  useEffect(() => {
    if (selectedAgent && sheetFaceRef.current) {
      const idx = agents.findIndex(a=>a.id===selectedAgent.id)
      drawFace(sheetFaceRef.current, idx, selectedAgent.state)
    }
  }, [selectedAgent])

  const stateColors: Record<AgentState,string> = { working:'#34C759', idle:'#FF9F0A', sleeping:'#AEB1BB' }
  const stateLabels: Record<AgentState,string> = { working:'עובד כעת 🟢', idle:'ממתין 🟡', sleeping:'ישן 🔘' }

  const WORKFLOW = [
    {step:'מנהל', out:'מנסח אסטרטגיה ומגדיר יעדים', st:'done',   tag:'הושלם'},
    {step:'פרופיל', out:'מנתח CV ו-LinkedIn', st:'done',          tag:'הושלם'},
    {step:'מחפש', out:'סורק משרות ומסנן לפי פרופיל', st:'running', tag:'פועל'},
    {step:'חוקר שוק', out:'חוקר חברות פוטנציאליות', st:'pending', tag:'ממתין'},
    {step:'מנטור', out:'מכין ייעוץ ומכתבי מוטיבציה', st:'pending', tag:'ממתין'},
  ]

  const working = agents.filter(a=>a.state==='working').length

  return (
    <>
      <style>{CSS}</style>
      <div className="office-root">
        {/* Top bar */}
        <div className="office-topbar">
          <button className="office-topbar-back" onClick={()=>onNavigate?.('career')}>←</button>
          <span className="office-topbar-title">משרד הסוכנים</span>
          <span className="office-topbar-badge">{working} פעילים</span>
        </div>

        <div className="scroll-content">
          {/* Pixel-art office canvas */}
          <div className="office-canvas-wrap" ref={wrapRef}>
            <div className="office-canvas-badge">קריירה</div>
            <div className="office-canvas-count">{working} פעילים מתוך {agents.length}</div>
            <canvas id="cvOff" ref={cvRef} />
          </div>

          {/* Agent faces row */}
          <div className="office-faces-section">
            <div className="office-faces-title">סוכני הצוות</div>
            <div className="ag-faces-row">
              {agents.map((ag,i)=>(
                <div key={ag.id} className="ag-face-slot" onClick={()=>setSelectedAgent(ag)}>
                  <div className={`ag-face-canvas ${ag.state}`}>
                    <AgentFace charIdx={i} state={ag.state} size={44} />
                  </div>
                  <div className="ag-face-name">{ag.name}</div>
                  <div className="ag-face-state">{ag.state==='working'?'🟢':ag.state==='idle'?'🟡':'⚫'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow panel */}
          <div className="office-workflow">
            <div className="office-workflow-title">🔄 תהליך עבודה</div>
            {WORKFLOW.map((w,i)=>(
              <div key={i} className="wf-item">
                <div className={`wf-step-icon ${w.st}`}>{w.st==='done'?'✓':w.st==='running'?'◉':'○'}</div>
                <div className="wf-step-content">
                  <div className="wf-agent"><b>{w.step}</b></div>
                  <div className="wf-out">{w.out}{w.st==='running'&&<span className="wf-cursor">|</span>}</div>
                  {w.st==='running'&&<div className="wf-running-bar"/>}
                  <span className={`wf-state ${w.st}`}>{w.tag}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Agent cards */}
          <div className="office-agents-section">
            {agents.map((ag,i)=>(
              <div key={ag.id} className="agent-card" onClick={()=>setSelectedAgent(ag)}>
                <div className="agent-card-top">
                  <div className="agent-card-av">
                    <AgentFace charIdx={i} state={ag.state} size={48} />
                    <div className="agent-state-dot" style={{background:stateColors[ag.state]}}/>
                  </div>
                  <div className="agent-card-info">
                    <div className="agent-card-name">{ag.emoji} {ag.name}</div>
                    <div className="agent-card-role">{ag.role}</div>
                    <div className="agent-card-state-lbl" style={{color:stateColors[ag.state]}}>
                      {stateLabels[ag.state]}
                    </div>
                  </div>
                </div>
                <div className="agent-card-desc">{ag.desc}</div>
                <div className="agent-card-sched">🕐 {ag.sched}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent detail sheet */}
        <div className={`ag-sheet-overlay${selectedAgent?' open':''}`}
          onClick={e=>{if(e.target===e.currentTarget)setSelectedAgent(null)}}>
          {selectedAgent && (
            <div className="ag-sheet">
              <div className="ag-sheet-handle"/>
              <div className="ags-top">
                <div className="ags-face">
                  <canvas ref={sheetFaceRef} style={{width:'54px',height:'54px',imageRendering:'pixelated',display:'block'}}/>
                </div>
                <div>
                  <div className="ags-name">{selectedAgent.emoji} {selectedAgent.name}</div>
                  <div className="ags-role">{selectedAgent.role}</div>
                  <div className="ags-state" style={{color:stateColors[selectedAgent.state]}}>
                    {stateLabels[selectedAgent.state]}
                  </div>
                </div>
              </div>
              <div className="ags-section">
                <div className="ags-sec-lbl">אחריות ותפקיד</div>
                <div className="ags-sec-body">{selectedAgent.desc}</div>
              </div>
              <div className="ags-section">
                <div className="ags-sec-lbl">לוז עבודה</div>
                <div className="ags-sched">🕐 {selectedAgent.sched}</div>
              </div>
              <div className="ags-section">
                <div className="ags-sec-lbl">שנה סטטוס</div>
                <div style={{display:'flex',gap:'8px'}}>
                  {(['working','idle','sleeping'] as AgentState[]).map(st=>(
                    <button key={st} onClick={()=>{
                      setAgents(p=>p.map(a=>a.id===selectedAgent.id?{...a,state:st}:a))
                      setSelectedAgent({...selectedAgent,state:st})
                    }} style={{
                      flex:1,padding:'8px 4px',borderRadius:'10px',border:'1px solid var(--brd)',
                      background:selectedAgent.state===st?stateColors[st]:'var(--surf2)',
                      color:selectedAgent.state===st?'#fff':'var(--fg2)',
                      fontFamily:'inherit',fontSize:'11px',fontWeight:600,cursor:'pointer'
                    }}>{st==='working'?'פועל':st==='idle'?'ממתין':'ישן'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
