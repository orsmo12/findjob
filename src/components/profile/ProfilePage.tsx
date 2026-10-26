'use client'

import { useState } from 'react'
import type { Page } from '@/components/layout/Sidebar'

interface OnboardingQ {
  id: string; question: string
  options: { label: string; value: string }[]
}
interface DomainConfig {
  id: string; icon: string; label: string; color: string
  description: string
  questions: OnboardingQ[]
  agents: { name: string; role: string; icon: string; unlockAt: number }[]
}
type Answers = Record<string, string>

const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    id: 'career', icon: '💼', label: 'קריירה', color: '#6366f1',
    description: 'חיפוש עבודה, פיתוח קריירה ומעקב ראיונות',
    questions: [
      {
        id: 'q_career_1', question: 'מה המטרה שלך כרגע בקריירה?',
        options: [
          { label: 'מחפש עבודה חדשה', value: 'job_search' },
          { label: 'קידום בתפקיד', value: 'promotion' },
          { label: 'מעבר תחום', value: 'pivot' },
          { label: 'בניית נטוורק', value: 'network' },
        ],
      },
      {
        id: 'q_career_2', question: 'כמה שנות ניסיון יש לך?',
        options: [
          { label: '0–2 שנים (Junior)', value: 'junior' },
          { label: '3–5 שנים (Mid)', value: 'mid' },
          { label: '6–10 שנים (Senior)', value: 'senior' },
          { label: '10+ שנים (Lead)', value: 'lead' },
        ],
      },
      {
        id: 'q_career_3', question: 'תחום טכנולוגי?',
        options: [
          { label: 'Full Stack / Web', value: 'fullstack' },
          { label: 'AI / ML / Data', value: 'ai_ml' },
          { label: 'Product Management', value: 'pm' },
          { label: 'DevOps / Cloud', value: 'devops' },
        ],
      },
      {
        id: 'q_career_4', question: 'איפה תרצה לעבוד?',
        options: [
          { label: 'Israel Tech Startup', value: 'il_startup' },
          { label: 'Global Remote', value: 'remote' },
          { label: 'FAANG / Big Tech', value: 'big_tech' },
          { label: 'פתוח לכל', value: 'open' },
        ],
      },
    ],
    agents: [
      { name: 'Query Strategist', role: 'מנסח שאילתות חיפוש חכמות', icon: '🎯', unlockAt: 25 },
      { name: 'Job Finder',       role: 'סורק LinkedIn, Indeed ועוד', icon: '🔍', unlockAt: 50 },
      { name: 'LinkedIn Scout',   role: 'מנתח פרופילים ו-HR',         icon: '🕵️', unlockAt: 75 },
      { name: 'Career Mentor',    role: 'הכנה לראיונות',              icon: '🧭', unlockAt: 80 },
      { name: 'Daily Assistant',  role: 'תקציר יומי ועדכונים',        icon: '📋', unlockAt: 90 },
    ],
  },
  {
    id: 'learning', icon: '📚', label: 'למידה', color: '#8b5cf6',
    description: 'קורסים, מיומנויות חדשות ומעקב התקדמות',
    questions: [
      {
        id: 'q_learn_1', question: 'מה תרצה ללמוד?',
        options: [
          { label: 'AI & Machine Learning', value: 'ai' },
          { label: 'Programming / Coding',  value: 'code' },
          { label: 'Business & Leadership', value: 'business' },
          { label: 'Design & UX',           value: 'design' },
        ],
      },
      {
        id: 'q_learn_2', question: 'כמה זמן פנוי בשבוע?',
        options: [
          { label: 'פחות משעה', value: '1h'  },
          { label: '1–3 שעות',  value: '3h'  },
          { label: '3–7 שעות',  value: '7h'  },
          { label: '7+ שעות',   value: '7h+' },
        ],
      },
    ],
    agents: [
      { name: 'Curator',     role: 'מוצא קורסים ומשאבים', icon: '📖', unlockAt: 30 },
      { name: 'Tracker',     role: 'מעקב התקדמות',         icon: '📊', unlockAt: 60 },
      { name: 'Quiz Master', role: 'בדיקת ידע וחיזוק',     icon: '🧠', unlockAt: 90 },
    ],
  },
  {
    id: 'sport', icon: '🏃', label: 'ספורט', color: '#10b981',
    description: 'אימונים, תזונה ומעקב ביצועים',
    questions: [
      {
        id: 'q_sport_1', question: 'מה מטרת הספורט שלך?',
        options: [
          { label: 'הרזיה',               value: 'lose_weight' },
          { label: 'בניית שריר',          value: 'muscle'      },
          { label: 'שיפור סיבולת',        value: 'endurance'   },
          { label: 'בריאות ואיכות חיים',  value: 'health'      },
        ],
      },
    ],
    agents: [
      { name: 'Coach',        role: 'תוכנית אימונים מותאמת', icon: '🏋️', unlockAt: 40 },
      { name: 'Nutritionist', role: 'תכנון תזונה ומעקב',     icon: '🥗',  unlockAt: 70 },
    ],
  },
  { id: 'health',  icon: '❤️', label: 'בריאות',  color: '#ef4444', description: 'בריאות נפשית, שינה ורווחה', questions: [], agents: [] },
  { id: 'finance', icon: '💰', label: 'פיננסים', color: '#f59e0b', description: 'תקציב, חסכונות והשקעות',    questions: [], agents: [] },
  { id: 'create',  icon: '🎨', label: 'יצירה',   color: '#ec4899', description: 'פרויקטים יצירתיים',        questions: [], agents: [] },
]

function AgentCard({ agent, color, progress }: {
  agent: DomainConfig['agents'][0]; color: string; progress: number
}) {
  const unlocked = progress >= agent.unlockAt
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl"
      style={{
        background: unlocked ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${unlocked ? color+'30' : 'rgba(255,255,255,0.06)'}`,
        opacity: unlocked ? 1 : 0.5,
      }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: unlocked ? `${color}20` : 'rgba(255,255,255,0.06)' }}>
        {unlocked ? agent.icon : '🔒'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{agent.name}</p>
        <p className="text-[10px] text-slate-500">{agent.role}</p>
      </div>
      {!unlocked ? (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-600"
          style={{ background:'rgba(255,255,255,0.05)' }}>{agent.unlockAt}%</span>
      ) : (
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }}/>
      )}
    </div>
  )
}

function DomainRow({ domain, active, expanded, progress, answers, onToggle, onAnswer, onActivate }: {
  domain: DomainConfig; active: boolean; expanded: boolean; progress: number; answers: Answers
  onToggle: () => void; onAnswer: (qId: string, val: string) => void; onActivate: () => void
}) {
  const totalQ    = domain.questions.length
  const answeredQ = domain.questions.filter(q => answers[q.id]).length

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${active ? domain.color+'30' : 'rgba(255,255,255,0.06)'}`,
        background: active ? `${domain.color}08` : 'rgba(255,255,255,0.03)',
      }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background:`${domain.color}15`, border:`1px solid ${domain.color}30` }}>
          {domain.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{domain.label}</p>
            {active && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background:`${domain.color}25`, color:domain.color }}>פעיל</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate">{domain.description}</p>
          {active && totalQ > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width:`${(answeredQ/totalQ)*100}%`, background:domain.color }}/>
              </div>
              <span className="text-[9px]" style={{ color:domain.color }}>{answeredQ}/{totalQ}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {!active ? (
            <button onClick={e => { e.stopPropagation(); onActivate() }}
              className="text-[10px] font-bold px-3 py-1.5 rounded-full"
              style={{ background:`${domain.color}20`, color:domain.color }}>הפעל</button>
          ) : (
            <span className="text-slate-600 text-sm">{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {expanded && active && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-5">
          {domain.questions.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-2">שאלות יתווספו בקרוב</p>
          ) : (
            <>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">שאלות הגדרה</h4>
              {domain.questions.map(q => (
                <div key={q.id}>
                  <p className="text-sm font-semibold text-white mb-2">{q.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map(opt => {
                      const selected = answers[q.id] === opt.value
                      return (
                        <button key={opt.value}
                          onClick={() => onAnswer(q.id, opt.value)}
                          className="text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95"
                          style={{
                            background: selected ? `${domain.color}20` : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${selected ? domain.color : 'rgba(255,255,255,0.08)'}`,
                            color: selected ? 'white' : '#64748b',
                          }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
          {domain.agents.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                סוכנים ({domain.agents.filter(a => progress >= a.unlockAt).length}/{domain.agents.length} פעילים)
              </h4>
              <div className="space-y-2">
                {domain.agents.map((a, i) => (
                  <AgentCard key={i} agent={a} color={domain.color} progress={progress} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ProfilePage({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set(['career']))
  const [expandedDomain, setExpandedDomain] = useState<string | null>('career')
  const [answers, setAnswers] = useState<Answers>({})

  const totalPossible = DOMAIN_CONFIGS
    .filter(d => activeDomains.has(d.id))
    .reduce((s, d) => s + d.questions.length, 0)
  const totalAnswered = Object.keys(answers).filter(k =>
    DOMAIN_CONFIGS.some(d => activeDomains.has(d.id) && d.questions.some(q => q.id === k))
  ).length
  const globalProgress = totalPossible === 0 ? 0 : Math.round((totalAnswered / totalPossible) * 100)

  function domainProgress(d: DomainConfig) {
    const total    = d.questions.length
    const answered = d.questions.filter(q => answers[q.id]).length
    return total === 0 ? 100 : Math.round((answered / total) * 100)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background:'#070a18' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => onNavigate?.('home')} className="flex items-center gap-1 text-slate-500 text-sm mb-4">
          ← חזרה
        </button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#6366f120,#8b5cf620)', border:'2px solid #6366f130' }}>
            🧑‍💻
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Life Builder</h1>
            <p className="text-sm text-slate-500">you@example.com</p>
          </div>
        </div>
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-400">התקדמות כוללת</span>
            <span className="text-sm font-black" style={{
              color: globalProgress >= 80 ? '#10b981' : globalProgress >= 50 ? '#6366f1' : '#f59e0b'
            }}>{globalProgress}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${globalProgress}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)' }}/>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {totalAnswered} מתוך {totalPossible} שאלות •{' '}
            {globalProgress >= 90 ? '🔓 כל הסוכנים פעילים!' :
             globalProgress >= 50 ? `🚀 עוד ${90 - globalProgress}% לסוכן הבא` :
             'ענה על שאלות כדי לפתוח סוכנים'}
          </p>
        </div>
      </div>

      {/* Domain list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          תחומים ({activeDomains.size} פעילים)
        </h2>
        {DOMAIN_CONFIGS.map(d => (
          <DomainRow
            key={d.id} domain={d}
            active={activeDomains.has(d.id)}
            expanded={expandedDomain === d.id}
            progress={domainProgress(d)}
            answers={answers}
            onToggle={() => { if (activeDomains.has(d.id)) setExpandedDomain(p => p === d.id ? null : d.id) }}
            onAnswer={(qId, val) => setAnswers(p => ({ ...p, [qId]: val }))}
            onActivate={() => {
              setActiveDomains(p => { const s = new Set(p); s.add(d.id); return s })
              setExpandedDomain(d.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}
