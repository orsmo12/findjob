'use client'
/**
 * AgentOfficePage — redesigned with cuter, clearer seated robot characters
 * Robots are visually seated behind desks with 3D-style layering
 */

import { useState, useEffect } from 'react'
import type { Page } from '@/components/layout/Sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────
type AgentState = 'working' | 'idle' | 'sleeping' | 'talking'

interface Agent {
  id: string; name: string; role: string; color: string
  highlight: string; emoji: string; state: AgentState; message?: string
}

const AGENTS: Agent[] = [
  { id:'strategist', name:'Strategist', role:'Query Design',    color:'#6366f1', highlight:'#818cf8', emoji:'🎯', state:'working',  message:'מנסח שאילתה...' },
  { id:'finder',     name:'Finder',     role:'Job Search',      color:'#06b6d4', highlight:'#22d3ee', emoji:'🔍', state:'idle',     message:undefined },
  { id:'scout',      name:'Scout',      role:'LinkedIn Intel',  color:'#8b5cf6', highlight:'#a78bfa', emoji:'🕵️', state:'sleeping', message:undefined },
  { id:'mentor',     name:'Mentor',     role:'Career Advice',   color:'#10b981', highlight:'#34d399', emoji:'🧭', state:'sleeping', message:undefined },
  { id:'assistant',  name:'Assistant',  role:'Daily Briefing',  color:'#f59e0b', highlight:'#fbbf24', emoji:'📋', state:'idle',     message:undefined },
]

// ─── Robot SVG — much more detailed and cute ──────────────────────────────────
function Robot({ agent, size = 1, selected }: { agent: Agent; size?: number; selected?: boolean }) {
  const c  = agent.color
  const hi = agent.highlight
  const isW = agent.state === 'working'
  const isS = agent.state === 'sleeping'
  const isT = agent.state === 'talking'
  const w = Math.round(70 * size)
  const h = Math.round(110 * size)

  return (
    <svg width={w} height={h} viewBox="0 0 70 110" style={{ overflow:'visible' }}>
      <defs>
        {/* Body gradient */}
        <linearGradient id={`bg-${agent.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hi}/>
          <stop offset="100%" stopColor={c}/>
        </linearGradient>
        {/* Sheen */}
        <linearGradient id={`sh-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        {/* Glow filter */}
        <filter id={`glow-${agent.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── SEAT (behind robot) ── */}
      <ellipse cx="35" cy="102" rx="20" ry="5" fill={c} opacity="0.3"/>
      <rect x="20" y="92" width="30" height="12" rx="5"
        fill={`url(#bg-${agent.id})`} opacity="0.6"/>

      {/* ── LEGS (seated — bent forward) ── */}
      {/* Left thigh */}
      <rect x="21" y="82" width="11" height="16" rx="5.5"
        fill={`url(#bg-${agent.id})`} opacity="0.85"
        transform="rotate(-8,26,90)"/>
      {/* Right thigh */}
      <rect x="38" y="82" width="11" height="16" rx="5.5"
        fill={`url(#bg-${agent.id})`} opacity="0.85"
        transform="rotate(8,44,90)"/>
      {/* Feet */}
      <ellipse cx="24" cy="100" rx="9" ry="5" fill={c} opacity="0.7"/>
      <ellipse cx="46" cy="100" rx="9" ry="5" fill={c} opacity="0.7"/>

      {/* ── BODY ── */}
      <rect x="16" y="50" width="38" height="35" rx="12"
        fill={`url(#bg-${agent.id})`}/>
      {/* Sheen on body */}
      <rect x="16" y="50" width="38" height="18" rx="12"
        fill={`url(#sh-${agent.id})`}/>
      {/* Chest panel */}
      <rect x="22" y="57" width="26" height="20" rx="7"
        fill="rgba(0,0,0,0.25)"/>
      {/* Chest center light */}
      <circle cx="35" cy="67" r="6" fill="rgba(0,0,0,0.3)"/>
      <circle cx="35" cy="67" r="4"
        fill={isW ? hi : 'rgba(255,255,255,0.1)'}
        className={isW ? 'animate-pulse' : ''}
        filter={isW ? `url(#glow-${agent.id})` : ''}/>
      {/* Side indicator lights */}
      <circle cx="25" cy="60" r="2" fill={isW ? '#4ade80' : 'rgba(255,255,255,0.15)'}/>
      <circle cx="45" cy="60" r="2" fill={isW ? '#facc15' : 'rgba(255,255,255,0.15)'}
        className={isW ? 'animate-pulse' : ''} style={{animationDelay:'0.3s'}}/>

      {/* ── ARMS (resting on desk) ── */}
      {/* Left arm */}
      <g className={isW ? 'animate-[armL_0.6s_ease-in-out_infinite_alternate]' : ''}>
        <rect x="4" y="53" width="13" height="28" rx="6.5"
          fill={`url(#bg-${agent.id})`} opacity="0.9"/>
        {/* Hand */}
        <ellipse cx="10.5" cy="82" rx="7" ry="5" fill={c} opacity="0.8"/>
      </g>
      {/* Right arm */}
      <g className={isW ? 'animate-[armR_0.6s_ease-in-out_infinite_alternate]' : ''}>
        <rect x="53" y="53" width="13" height="28" rx="6.5"
          fill={`url(#bg-${agent.id})`} opacity="0.9"/>
        <ellipse cx="59.5" cy="82" rx="7" ry="5" fill={c} opacity="0.8"/>
      </g>

      {/* ── NECK ── */}
      <rect x="28" y="42" width="14" height="10" rx="5" fill={c}/>

      {/* ── HEAD ── */}
      <rect x="10" y="8" width="50" height="38" rx="16"
        fill={`url(#bg-${agent.id})`}/>
      {/* Head sheen */}
      <rect x="10" y="8" width="50" height="20" rx="16"
        fill={`url(#sh-${agent.id})`}/>

      {/* ── EYES ── */}
      {isS ? (
        /* Sleeping lines */
        <>
          <line x1="19" y1="27" x2="29" y2="27" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="41" y1="27" x2="51" y2="27" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      ) : (
        /* Open eyes */
        <>
          {/* Eye sockets */}
          <ellipse cx="24" cy="26" rx="8" ry="8" fill="rgba(0,0,0,0.4)"/>
          <ellipse cx="46" cy="26" rx="8" ry="8" fill="rgba(0,0,0,0.4)"/>
          {/* Irises */}
          <circle cx="24" cy="26" r="5.5" fill="white" opacity="0.9"
            className={isW ? 'animate-[blink_3s_infinite]' : ''}/>
          <circle cx="46" cy="26" r="5.5" fill="white" opacity="0.9"
            className={isW ? 'animate-[blink_3s_infinite]' : ''} style={{animationDelay:'0.08s'}}/>
          {/* Pupils */}
          <circle cx={isT?25:24} cy={isT?27:26} r="3" fill={c}/>
          <circle cx={isT?47:46} cy={isT?27:26} r="3" fill={c}/>
          {/* Eye shine */}
          <circle cx="26" cy="24" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="48" cy="24" r="1.5" fill="white" opacity="0.7"/>
        </>
      )}

      {/* ── MOUTH ── */}
      {isS ? (
        <path d="M28 35 Q35 33 42 35" stroke="rgba(0,0,0,0.3)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      ) : isT ? (
        <ellipse cx="35" cy="35" rx="7" ry="4" fill="rgba(0,0,0,0.35)"/>
      ) : isW ? (
        <path d="M27 35 Q35 40 43 35" stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      ) : (
        <path d="M28 34 Q35 38 42 34" stroke="rgba(0,0,0,0.3)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      )}

      {/* ── ANTENNA ── */}
      <line x1="35" y1="8" x2="35" y2="-2" stroke={hi} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="35" cy="-5" r="4" fill={hi}
        className="animate-pulse" filter={`url(#glow-${agent.id})`}/>

      {/* ── Ear bolts ── */}
      <circle cx="10" cy="25" r="4" fill={c} opacity="0.7"/>
      <circle cx="60" cy="25" r="4" fill={c} opacity="0.7"/>
      <circle cx="10" cy="25" r="2" fill={hi} opacity="0.5"/>
      <circle cx="60" cy="25" r="2" fill={hi} opacity="0.5"/>

      {/* ── ZZZ (sleeping) ── */}
      {isS && (
        <>
          <text x="58" y="5" fontSize="10" fontWeight="bold" fill={hi}
            className="animate-[zzzFloat_2s_ease-in-out_infinite]" opacity="0.8">z</text>
          <text x="64" y="-3" fontSize="7" fontWeight="bold" fill={hi}
            className="animate-[zzzFloat_2s_0.7s_ease-in-out_infinite]" opacity="0.6">z</text>
        </>
      )}

      {/* ── Working dots ── */}
      {isW && (
        <g transform="translate(28,44)">
          {[0,0.15,0.3].map((d,i) => (
            <circle key={i} cx={i*6} cy="0" r="2"
              fill={hi} className="animate-[typingDot_0.8s_ease-in-out_infinite]"
              style={{animationDelay:`${d}s`}}/>
          ))}
        </g>
      )}

      {/* ── Selected glow ring ── */}
      {selected && (
        <rect x="10" y="8" width="50" height="38" rx="16"
          fill="none" stroke={hi} strokeWidth="2.5" opacity="0.6"
          className="animate-pulse"/>
      )}
    </svg>
  )
}

// ─── Desk ─────────────────────────────────────────────────────────────────────
function Desk({ agent }: { agent: Agent }) {
  const isW = agent.state === 'working'
  const c   = agent.color
  return (
    <svg width="130" height="60" viewBox="0 0 130 60" style={{ overflow:'visible' }}>
      <defs>
        <linearGradient id={`desk-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2340"/>
          <stop offset="100%" stopColor="#111827"/>
        </linearGradient>
      </defs>
      {/* Desk surface */}
      <rect x="0" y="0" width="130" height="14" rx="4"
        fill={`url(#desk-${agent.id})`} stroke={`${c}30`} strokeWidth="1"/>
      {/* Desk shine */}
      <rect x="4" y="2" width="122" height="5" rx="2" fill="white" opacity="0.05"/>
      {/* Legs */}
      <rect x="8"   y="14" width="8" height="44" rx="3" fill="#0f1322"/>
      <rect x="114" y="14" width="8" height="44" rx="3" fill="#0f1322"/>
      {/* Cross brace */}
      <rect x="8" y="40" width="114" height="5" rx="2.5" fill="#0f1322" opacity="0.7"/>

      {/* Monitor */}
      <rect x="45" y="-30" width="40" height="26" rx="5"
        fill="#050810" stroke={`${c}40`} strokeWidth="1.5"/>
      {/* Screen */}
      <rect x="47" y="-28" width="36" height="22" rx="3"
        fill={isW ? `${c}18` : '#080b18'}/>
      {/* Code lines */}
      {isW && [0,1,2].map(i => (
        <rect key={i} x={51} y={-25+i*7} width={i===1?24:18} height="3" rx="1.5"
          fill={c} opacity={0.4-i*0.08}
          className="animate-pulse" style={{animationDelay:`${i*0.2}s`}}/>
      ))}
      {/* Monitor stand */}
      <rect x="62" y="-4" width="6" height="6" rx="1" fill="#0f1322"/>
      <rect x="55" y="2"  width="20" height="3" rx="1.5" fill="#0f1322"/>

      {/* Keyboard */}
      <rect x="30" y="6" width="50" height="7" rx="2"
        fill="#0a0d1e" stroke={`${c}20`} strokeWidth="1"
        className={isW ? 'animate-pulse' : ''}/>
      {/* Keys */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={32+i*6} y="8" width="4" height="3" rx="0.5"
          fill={isW ? c : '#1e2340'} opacity={isW?0.4:0.5}
          style={{animationDelay:`${i*0.05}s`}}/>
      ))}

      {/* Mouse */}
      <ellipse cx="92" cy="9" rx="5" ry="4" fill="#0a0d1e" stroke={`${c}20`} strokeWidth="1"/>
      <line x1="92" y1="6" x2="92" y2="12" stroke={`${c}30`} strokeWidth="1"/>

      {/* Mug */}
      <rect x="110" y="1" width="11" height="12" rx="3" fill="#0d101f"/>
      <path d="M121 5 Q127 5 127 9 Q127 13 121 13" fill="none" stroke="#1e2340" strokeWidth="2"/>
      <rect x="112" y="3" width="7" height="3" rx="1" fill={c} opacity="0.4"/>
    </svg>
  )
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function SpeechBubble({ message, color }: { message: string; color: string }) {
  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap
      px-3 py-1.5 rounded-xl text-[10px] font-bold text-white animate-[popIn_0.3s_ease-out]"
      style={{ background:`${color}ee`, border:`1px solid ${color}`, boxShadow:`0 4px 16px ${color}50` }}>
      {message}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:`6px solid ${color}` }}/>
    </div>
  )
}

// ─── Agent Station ────────────────────────────────────────────────────────────
function AgentStation({ agent, selected, onClick }: {
  agent: Agent; selected: boolean; onClick: () => void
}) {
  return (
    <div className="relative flex flex-col items-center cursor-pointer group" onClick={onClick}>
      {/* Selection glow */}
      {selected && (
        <div className="absolute inset-0 rounded-2xl opacity-20 animate-pulse"
          style={{ background: agent.color, filter:'blur(12px)', zIndex:0 }}/>
      )}

      {/* Speech bubble */}
      {agent.message && agent.state !== 'sleeping' && (
        <SpeechBubble message={agent.message} color={agent.color} />
      )}

      {/* Robot (above desk) */}
      <div className="relative z-10" style={{ marginBottom: -10 }}>
        <Robot agent={agent} selected={selected} />
      </div>

      {/* Desk */}
      <div className="relative z-10">
        <Desk agent={agent} />
      </div>

      {/* Name label */}
      <div className="mt-2 text-center z-10">
        <p className="text-[11px] font-bold leading-tight" style={{ color: agent.color }}>
          {agent.name}
        </p>
        <p className="text-[9px] text-slate-600 leading-tight">{agent.role}</p>
      </div>
    </div>
  )
}

// ─── Office Room ──────────────────────────────────────────────────────────────
function OfficeRoom({ agents, selectedId, onSelect }: {
  agents: Agent[]; selectedId: string | null; onSelect: (id: string) => void
}) {
  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden"
      style={{ background:'#070a18', border:'1px solid rgba(255,255,255,0.06)' }}>

      {/* Room back wall */}
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(180deg, #0d1030 0%, #090c22 50%, #070a18 100%)' }}/>

      {/* Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4"
        style={{ background:'linear-gradient(180deg,#0a0d1a,#0e1225)' }}>
        {/* Floor tiles */}
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="absolute top-0 bottom-0" style={{
            left:`${i*16.7}%`, width:'16.7%',
            borderRight:'1px solid rgba(255,255,255,0.03)'
          }}/>
        ))}
      </div>

      {/* Ceiling light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-2 rounded-b-full"
        style={{ background:'rgba(99,102,241,0.3)', boxShadow:'0 0 40px 20px rgba(99,102,241,0.08)' }}/>

      {/* Window (left) */}
      <div className="absolute top-4 left-4 w-16 h-20 rounded-lg overflow-hidden"
        style={{ background:'#050e25', border:'1px solid rgba(99,102,241,0.2)' }}>
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
          {[0,1,2,3].map(i => (
            <div key={i} className="rounded-sm" style={{ background:'#07102a' }}>
              {/* City lights */}
              {[0,1,2].map(j => (
                <div key={j} className="w-1 h-0.5 rounded-sm mx-0.5 mt-1 animate-pulse"
                  style={{ background:`hsl(${200+j*20},80%,60%)`, opacity:0.5, animationDelay:`${(i+j)*0.3}s` }}/>
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-white/5"/>
          <div className="h-px w-full bg-white/5 absolute"/>
        </div>
      </div>

      {/* Plant (right) */}
      <div className="absolute top-4 right-4 flex flex-col items-center">
        <div className="text-2xl">🌿</div>
        <div className="w-6 h-3 rounded-b-sm" style={{ background:'#1e2340' }}/>
      </div>

      {/* Logo text */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-black tracking-widest"
        style={{ color:'rgba(99,102,241,0.3)' }}>
        LIFE BUILDING
      </div>

      {/* Agents — 2 rows: 3 top, 2 bottom centered */}
      <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 pt-4 pb-2 px-2">
        {/* Row 1 */}
        <div className="flex gap-4 justify-center items-end w-full">
          {agents.slice(0, 3).map(a => (
            <AgentStation key={a.id} agent={a} selected={selectedId === a.id}
              onClick={() => onSelect(a.id)} />
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-4 justify-center items-end w-full">
          {agents.slice(3).map(a => (
            <AgentStation key={a.id} agent={a} selected={selectedId === a.id}
              onClick={() => onSelect(a.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AgentOfficePage({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [agents, setAgents] = useState<Agent[]>(AGENTS)
  const [selectedId, setSelectedId] = useState<string | null>('strategist')

  // Demo animation cycle
  useEffect(() => {
    const CYCLE: Array<Partial<Agent> & { id: string }> = [
      { id:'finder',     state:'working',  message:'23 משרות נמצאו!' },
      { id:'strategist', state:'talking',  message:'מעדכן קריטריונים' },
      { id:'scout',      state:'working',  message:'סורק LinkedIn...' },
      { id:'finder',     state:'idle',     message:undefined },
      { id:'strategist', state:'working',  message:'מנסח שאילתה...' },
      { id:'scout',      state:'sleeping', message:undefined },
    ]
    let i = 0
    const t = setInterval(() => {
      const patch = CYCLE[i % CYCLE.length]
      setAgents(prev => prev.map(a => a.id === patch.id ? { ...a, ...patch } : a))
      i++
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const selected = agents.find(a => a.id === selectedId)

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background:'#070a18' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="text-base font-black text-white">Agent Office</h1>
          <p className="text-xs text-slate-500">
            {agents.filter(a => a.state === 'working').length} עובדים •{' '}
            {agents.filter(a => a.state === 'sleeping').length} ישנים
          </p>
        </div>
        <button onClick={() => onNavigate?.('home')}
          className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 text-sm">
          ✕
        </button>
      </div>

      {/* Office viewport */}
      <div className="flex-1 px-3 pb-2" style={{ minHeight:0 }}>
        <OfficeRoom agents={agents} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Selected agent detail */}
      {selected && (
        <div className="flex-shrink-0 mx-3 mb-3 p-4 rounded-2xl animate-[fadeUp_0.3s_ease-out]"
          style={{ background:`${selected.color}12`, border:`1px solid ${selected.color}30` }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background:`${selected.color}20` }}>
              {selected.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-white">{selected.name}</p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: selected.state === 'working' ? '#10b98125' :
                                selected.state === 'sleeping' ? '#33415525' : `${selected.color}20`,
                    color: selected.state === 'working' ? '#10b981' :
                           selected.state === 'sleeping' ? '#64748b' : selected.color
                  }}>
                  {selected.state === 'working' ? '● עובד' :
                   selected.state === 'sleeping' ? '💤 ישן' :
                   selected.state === 'talking' ? '💬 מדבר' : '○ ממתין'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{selected.role}</p>
              {selected.message && selected.state !== 'sleeping' && (
                <p className="text-xs mt-1" style={{ color: selected.color }}>
                  {selected.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent strip */}
      <div className="flex-shrink-0 border-t border-white/5 px-3 py-2"
        style={{ background:'rgba(7,10,24,0.95)' }}>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {agents.map(a => (
            <button key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all"
              style={{
                background: selectedId === a.id ? `${a.color}20` : 'transparent',
                border: `1px solid ${selectedId === a.id ? a.color+'40' : 'transparent'}`,
              }}>
              <div className="relative">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ background:`${a.color}20` }}>
                  {a.emoji}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black"
                  style={{
                    background: a.state === 'working' ? '#10b981' :
                                a.state === 'sleeping' ? '#334155' : '#f59e0b'
                  }}/>
              </div>
              <span className="text-[9px] font-bold" style={{ color: a.color }}>{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
