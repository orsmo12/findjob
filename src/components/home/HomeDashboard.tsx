'use client'
/**
 * HomeDashboard — Life Building
 *
 * Layout:
 *  TOP: Domain carousel (swipe left/right, selected domain centered & bigger)
 *  BODY (when domain selected): split view
 *    LEFT 1/3:  Mini office + live workflow list
 *    RIGHT 2/3: Domain actions, tasks, notifications, history
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Page } from '@/components/layout/Sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Domain {
  id: string; page: Page; icon: string; label: string; color: string
  active: boolean; agents: AgentMini[]; progress: number
}
interface AgentMini { name: string; role: string; color: string; state: 'working'|'idle'|'sleeping' }
interface WorkflowItem { icon: string; text: string; time: string; done: boolean }
interface ActionItem { icon: string; title: string; subtitle: string; badge?: string; color: string; urgent?: boolean }

// ─── Data ─────────────────────────────────────────────────────────────────────
const CAREER_AGENTS: AgentMini[] = [
  { name:'Strategist', role:'Query',   color:'#6366f1', state:'working'  },
  { name:'Finder',     role:'Search',  color:'#06b6d4', state:'idle'     },
  { name:'Scout',      role:'Intel',   color:'#8b5cf6', state:'sleeping' },
  { name:'Mentor',     role:'Skills',  color:'#10b981', state:'sleeping' },
  { name:'Assistant',  role:'Briefing',color:'#f59e0b', state:'idle'     },
]

const DOMAINS: Domain[] = [
  { id:'career', page:'career', icon:'💼', label:'קריירה',   color:'#6366f1', active:true,  agents:CAREER_AGENTS, progress:72 },
  { id:'learning',page:'home',  icon:'📚', label:'למידה',    color:'#8b5cf6', active:false, agents:[], progress:0  },
  { id:'sport',   page:'home',  icon:'🏃', label:'ספורט',    color:'#10b981', active:false, agents:[], progress:0  },
  { id:'health',  page:'home',  icon:'❤️', label:'בריאות',  color:'#ef4444', active:false, agents:[], progress:0  },
  { id:'finance', page:'home',  icon:'💰', label:'פיננסים', color:'#f59e0b', active:false, agents:[], progress:0  },
  { id:'create',  page:'home',  icon:'🎨', label:'יצירה',   color:'#ec4899', active:false, agents:[], progress:0  },
]

const CAREER_WORKFLOW: WorkflowItem[] = [
  { icon:'✅', text:'Query Strategist סיים שאילתה', time:'08:42', done:true  },
  { icon:'⚡', text:'Job Finder סורק LinkedIn...',  time:'08:43', done:false },
  { icon:'○',  text:'Scout — ממתין לתורו',          time:'—',     done:false },
  { icon:'○',  text:'Mentor — ממתין',               time:'—',     done:false },
  { icon:'○',  text:'Daily Brief — ממתין',          time:'—',     done:false },
]

const CAREER_ACTIONS: ActionItem[] = [
  { icon:'📨', title:'שלח קורות חיים',    subtitle:'Google · 87% match · מכתב מוכן', badge:'חדש', color:'#6366f1', urgent:true  },
  { icon:'📅', title:'ראיון — Monday.com', subtitle:'מחר 14:00 — הכנה מוכנה',        badge:'מחר', color:'#10b981', urgent:true  },
  { icon:'🎯', title:'הכנה לראיון',       subtitle:'5 שאלות לתרגול • System Design', color:'#8b5cf6' },
  { icon:'📋', title:'משרות לסקירה',      subtitle:'23 משרות חדשות מאתמול',          badge:'23',  color:'#06b6d4' },
  { icon:'📈', title:'כיוון חדש',         subtitle:'Startup Ecosystem — הזדמנות',    color:'#f59e0b' },
  { icon:'🕐', title:'היסטוריה',          subtitle:'12 בקשות נשלחו החודש',           color:'#64748b' },
]

// ─── Mini Robot for agent strip ───────────────────────────────────────────────
function MiniRobot({ agent }: { agent: AgentMini }) {
  const isWorking  = agent.state === 'working'
  const isSleeping = agent.state === 'sleeping'
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className="relative">
        {/* Robot body */}
        <svg width="40" height="52" viewBox="0 0 40 52">
          {/* Body */}
          <rect x="8" y="22" width="24" height="18" rx="6" fill={agent.color} opacity="0.9"/>
          {/* Chest light */}
          <circle cx="20" cy="31" r="4" fill="rgba(0,0,0,0.3)"/>
          <circle cx="20" cy="31" r="2" fill={isWorking ? 'white' : 'rgba(255,255,255,0.2)'}
            className={isWorking ? 'animate-pulse' : ''}/>
          {/* Arms */}
          <rect x="2"  y="24" width="7" height="12" rx="3.5" fill={agent.color} opacity="0.8"
            className={isWorking ? 'animate-[armL_0.5s_ease-in-out_infinite_alternate]' : ''}/>
          <rect x="31" y="24" width="7" height="12" rx="3.5" fill={agent.color} opacity="0.8"
            className={isWorking ? 'animate-[armR_0.5s_ease-in-out_infinite_alternate]' : ''}/>
          {/* Neck */}
          <rect x="15" y="17" width="10" height="6" rx="3" fill={agent.color}/>
          {/* Head */}
          <rect x="6" y="2" width="28" height="22" rx="8" fill={agent.color}/>
          {/* Eyes */}
          {isSleeping ? (
            <>
              <line x1="12" y1="13" x2="17" y2="13" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="23" y1="13" x2="28" y2="13" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round"/>
            </>
          ) : (
            <>
              <circle cx="14" cy="12" r="4" fill="rgba(0,0,0,0.35)"/>
              <circle cx="26" cy="12" r="4" fill="rgba(0,0,0,0.35)"/>
              <circle cx="14" cy="12" r="2.5" fill="white" opacity="0.9"
                className={isWorking ? 'animate-[blink_3s_infinite]' : ''}/>
              <circle cx="26" cy="12" r="2.5" fill="white" opacity="0.9"
                className={isWorking ? 'animate-[blink_3s_infinite]' : ''} style={{animationDelay:'0.1s'}}/>
            </>
          )}
          {/* Antenna */}
          <line x1="20" y1="2" x2="20" y2="-4" stroke={agent.color} strokeWidth="2"/>
          <circle cx="20" cy="-5" r="2.5" fill={agent.color} className="animate-pulse"/>
          {/* Legs */}
          <rect x="11" y="40" width="8"  height="10" rx="3" fill={agent.color} opacity="0.8"/>
          <rect x="21" y="40" width="8"  height="10" rx="3" fill={agent.color} opacity="0.8"/>
        </svg>
        {/* ZZZ */}
        {isSleeping && (
          <div className="absolute -top-3 -right-1 text-[8px] font-bold leading-tight"
            style={{ color: agent.color }}>
            <span className="block animate-[zzzFloat_2s_ease-in-out_infinite]">z</span>
            <span className="block animate-[zzzFloat_2s_ease-in-out_0.7s_infinite] text-[6px]">z</span>
          </div>
        )}
        {/* Working dots */}
        {isWorking && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[0,0.15,0.3].map((d,i) => (
              <div key={i} className="w-1 h-1 rounded-full animate-[typingDot_0.8s_ease-in-out_infinite]"
                style={{ background: agent.color, animationDelay:`${d}s` }}/>
            ))}
          </div>
        )}
      </div>
      <span className="text-[8px] font-bold text-center leading-tight"
        style={{ color: agent.color }}>{agent.name}</span>
      <span className="text-[7px] text-slate-600">{agent.role}</span>
    </div>
  )
}

// ─── Mini Office Strip ────────────────────────────────────────────────────────
function MiniOffice({ domain, onExpand }: { domain: Domain; onExpand: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ borderRight:'1px solid rgba(255,255,255,0.06)' }}>
      {/* Office viewport */}
      <div className="flex-1 relative overflow-hidden rounded-xl mx-2 mt-2 cursor-pointer"
        style={{ background:'#070a18', border:`1px solid ${domain.color}20` }}
        onClick={onExpand}>
        {/* Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3"
          style={{ background:'linear-gradient(#0a0d1a,#0e1225)' }}/>
        {/* Wall */}
        <div className="absolute top-0 left-0 right-0 h-2/3"
          style={{ background:'linear-gradient(#0d1030,#0a0d1a)' }}/>
        {/* Window */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-8 rounded"
          style={{ background:'#07102a', border:`1px solid ${domain.color}30` }}>
          {[0,1,2].map(i=>(
            <div key={i} className="absolute w-1 h-1 rounded-full animate-pulse"
              style={{ background:domain.color, opacity:0.4, left:2+i*4, top:3 }}/>
          ))}
        </div>
        {/* Robots tiny */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-around items-end px-1">
          {domain.agents.slice(0,3).map((a,i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-6 h-8 rounded-t-lg rounded-b-sm flex items-center justify-center"
                style={{ background:`${a.color}25`, border:`1px solid ${a.color}40` }}>
                <div className="w-3 h-3 rounded-full"
                  style={{ background:a.color, opacity: a.state==='sleeping'?0.3:0.9 }}/>
              </div>
              <div className="w-6 h-1.5 rounded-sm" style={{ background:'#1e2340' }}/>
            </div>
          ))}
        </div>
        {/* Expand hint */}
        <div className="absolute top-1 right-1 text-[8px] text-slate-700">↗</div>
      </div>

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ minHeight:0 }}>
        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider px-1 mb-1">Workflow</p>
        {CAREER_WORKFLOW.map((w,i) => (
          <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg"
            style={{ background: !w.done && i===1 ? `${domain.color}12` : 'transparent' }}>
            <span className="text-[10px] flex-shrink-0"
              style={{ color: w.done?'#10b981': i===1?domain.color:'#334155' }}>
              {w.icon}
            </span>
            <span className="text-[9px] leading-tight flex-1 min-w-0 truncate"
              style={{ color: w.done?'#4ade80': i===1?'white':'#334155' }}>
              {w.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Domain Actions Panel ─────────────────────────────────────────────────────
function DomainActions({ domain }: { domain: Domain }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-2 gap-2">
      {CAREER_ACTIONS.map((a,i) => (
        <div key={i}
          className="flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-98 cursor-pointer"
          style={{
            background: a.urgent ? `${a.color}12` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${a.urgent ? a.color+'30' : 'rgba(255,255,255,0.06)'}`,
          }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background:`${a.color}20` }}>
            {a.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{a.title}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{a.subtitle}</p>
          </div>
          {a.badge && (
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background:`${a.color}25`, color:a.color }}>
              {a.badge}
            </span>
          )}
          <span className="text-slate-700 text-sm flex-shrink-0">›</span>
        </div>
      ))}
    </div>
  )
}

// ─── Domain Carousel ──────────────────────────────────────────────────────────
function DomainCarousel({ domains, selected, onSelect }: {
  domains: Domain[]; selected: number; onSelect: (i:number)=>void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Center selected item
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll('[data-domain]')
    const item = items[selected] as HTMLElement
    if (item) {
      const left = item.offsetLeft - el.clientWidth/2 + item.clientWidth/2
      el.scrollTo({ left, behavior:'smooth' })
    }
  }, [selected])

  return (
    <div ref={ref}
      className="flex items-end gap-3 px-4 py-3 overflow-x-auto scrollbar-none"
      style={{ scrollSnapType:'x mandatory' }}>
      {domains.map((d, i) => {
        const isSelected = i === selected
        const isActive   = d.active
        return (
          <button key={d.id} data-domain={d.id}
            onClick={() => onSelect(i)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300"
            style={{ scrollSnapAlign:'center' }}>
            {/* Domain circle */}
            <div className="rounded-2xl flex items-center justify-center transition-all duration-300"
              style={{
                width:  isSelected ? 64 : 44,
                height: isSelected ? 64 : 44,
                background: isSelected ? `${d.color}25` : isActive ? `${d.color}15` : 'rgba(255,255,255,0.04)',
                border: `2px solid ${isSelected ? d.color : isActive ? d.color+'40' : 'rgba(255,255,255,0.08)'}`,
                opacity: isActive ? 1 : 0.45,
                boxShadow: isSelected ? `0 0 20px ${d.color}40` : 'none',
              }}>
              <span style={{ fontSize: isSelected ? 28 : 20 }}>{d.icon}</span>
            </div>
            {/* Label */}
            <span className="font-bold transition-all duration-300"
              style={{
                fontSize: isSelected ? 13 : 10,
                color: isSelected ? d.color : isActive ? '#94a3b8' : '#334155',
              }}>
              {d.label}
            </span>
            {/* Active dot */}
            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: d.color }}/>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HomeDashboard({
  onNavigate,
  priorities,
}: {
  onNavigate?: (page: Page) => void
  priorities?: unknown[]
}) {
  const [selectedDomain, setSelectedDomain] = useState(0)
  const domain = DOMAINS[selectedDomain]

  const handleOfficeExpand = useCallback(() => {
    onNavigate?.('office')
  }, [onNavigate])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background:'#070a18' }}>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-1">
        <h1 className="text-base font-bold text-white">Life Building</h1>
        <button onClick={() => onNavigate?.('profile')}
          className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 text-sm">
          👤
        </button>
      </div>

      {/* Domain name — big */}
      <div className="flex-shrink-0 px-4 pb-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-3xl font-black text-white">{domain.label}</h2>
          {domain.active && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background:`${domain.color}20`, color:domain.color }}>
              פעיל
            </span>
          )}
        </div>
        {domain.active && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/8">
              <div className="h-full rounded-full transition-all"
                style={{ width:`${domain.progress}%`, background:`linear-gradient(90deg,${domain.color},${domain.color}88)` }}/>
            </div>
            <span className="text-xs font-bold" style={{ color:domain.color }}>{domain.progress}%</span>
          </div>
        )}
      </div>

      {/* ── Main split view ── */}
      {domain.active ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT 1/3: mini office + workflow */}
          <div className="w-1/3 flex flex-col overflow-hidden">
            <MiniOffice domain={domain} onExpand={handleOfficeExpand} />
          </div>

          {/* RIGHT 2/3: domain actions */}
          <div className="flex-1 overflow-hidden">
            <DomainActions domain={domain} />
          </div>
        </div>
      ) : (
        /* Inactive domain — onboarding CTA */
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
            style={{ background:`${domain.color}15`, border:`2px solid ${domain.color}30` }}>
            {domain.icon}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-1">הפעל את {domain.label}</h3>
            <p className="text-sm text-slate-500">ענה על כמה שאלות כדי להפעיל את הסוכנים</p>
          </div>
          <button
            onClick={() => onNavigate?.('profile')}
            className="px-6 py-3 rounded-2xl font-bold text-white text-sm"
            style={{ background:`linear-gradient(135deg,${domain.color},${domain.color}aa)` }}>
            התחל הגדרה ›
          </button>
        </div>
      )}

      {/* ── Agent strip (bottom, above carousel) ── */}
      {domain.active && domain.agents.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/5 px-3 py-2"
          style={{ background:'rgba(7,10,24,0.95)' }}>
          <div className="flex gap-4 justify-around">
            {domain.agents.map((a,i) => (
              <MiniRobot key={i} agent={a} />
            ))}
          </div>
        </div>
      )}

      {/* ── Domain carousel (bottom) ── */}
      <div className="flex-shrink-0 border-t border-white/5"
        style={{ background:'rgba(10,13,26,0.98)' }}>
        <DomainCarousel
          domains={DOMAINS}
          selected={selectedDomain}
          onSelect={setSelectedDomain}
        />
      </div>
    </div>
  )
}
