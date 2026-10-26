'use client'

/**
 * PipelinePage — Kanban לניהול בקשות עבודה
 *
 * שלבי הpipeline:
 *   saved → applied → phone_screen → interview → technical → final_round
 *   → offer → accepted / rejected / withdrawn / ghosted
 *
 * כל משרה ניתנת לגרירה בין עמודות (drag & drop).
 * נתונים נשמרים ב-localStorage (ובהמשך ל-Supabase).
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interview'
  | 'technical'
  | 'final_round'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'

export interface PipelineJob {
  id:          string
  title:       string
  company:     string
  location:    string
  salary:      string
  url:         string
  ats_score:   number
  source:      string
  stage:       PipelineStage
  added_at:    string
  updated_at:  string
  notes:       string
  cover_letter?: string
}

// ── Stage Config ───────────────────────────────────────────────────────────────

const ACTIVE_STAGES: { id: PipelineStage; label: string; color: string; emoji: string }[] = [
  { id: 'saved',       label: 'שמורות',         color: 'bg-slate-100 dark:bg-slate-800',  emoji: '🔖' },
  { id: 'applied',     label: 'הוגשו',          color: 'bg-blue-100  dark:bg-blue-900',   emoji: '📤' },
  { id: 'phone_screen',label: 'שיחת מיון',      color: 'bg-indigo-100 dark:bg-indigo-900',emoji: '📞' },
  { id: 'interview',   label: 'ראיון',           color: 'bg-purple-100 dark:bg-purple-900',emoji: '🤝' },
  { id: 'technical',   label: 'מבחן טכני',      color: 'bg-amber-100  dark:bg-amber-900', emoji: '💻' },
  { id: 'final_round', label: 'סיבוב אחרון',    color: 'bg-orange-100 dark:bg-orange-900',emoji: '🏁' },
  { id: 'offer',       label: 'הצעה',           color: 'bg-green-100  dark:bg-green-900', emoji: '🎉' },
]

const CLOSED_STAGES: { id: PipelineStage; label: string; emoji: string }[] = [
  { id: 'accepted',   label: 'התקבלתי', emoji: '✅' },
  { id: 'rejected',   label: 'נדחיתי',  emoji: '❌' },
  { id: 'withdrawn',  label: 'ביטלתי',  emoji: '↩️' },
  { id: 'ghosted',    label: 'רוח',     emoji: '👻' },
]

const STORAGE_KEY = 'lb-pipeline-v2'

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadJobs(): PipelineJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveJobs(jobs: PipelineJob[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)) } catch {}
}

function jobsByStage(jobs: PipelineJob[]): Record<PipelineStage, PipelineJob[]> {
  const map: Record<string, PipelineJob[]> = {}
  for (const s of [...ACTIVE_STAGES, ...CLOSED_STAGES]) map[s.id] = []
  for (const j of jobs) {
    if (map[j.stage]) map[j.stage].push(j)
    else map['saved'].push(j)
  }
  return map as Record<PipelineStage, PipelineJob[]>
}

// ── Score Badge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
    score >= 45 ? 'bg-blue-100  text-blue-700  dark:bg-blue-900  dark:text-blue-300'  :
                  'bg-slate-100 text-slate-600  dark:bg-slate-800 dark:text-slate-400'
  return (
    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${color}`}>
      {score}
    </span>
  )
}

// ── Job Card ───────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onMove,
  onDelete,
  onOpenDetail,
  stages,
}: {
  job: PipelineJob
  onMove: (id: string, stage: PipelineStage) => void
  onDelete: (id: string) => void
  onOpenDetail: (job: PipelineJob) => void
  stages: { id: PipelineStage; label: string; emoji: string }[]
}) {
  const [expanded, setExpanded] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('jobId', job.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800
                 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300
                 dark:hover:border-blue-700 transition-all select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{job.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.company}</p>
        </div>
        <ScoreBadge score={job.ats_score} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {job.location && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5">
            📍 {job.location}
          </span>
        )}
        {job.salary && job.salary !== '-' && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5">
            💰 {job.salary}
          </span>
        )}
        {job.source && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 rounded px-1.5 py-0.5">
            {job.source}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
          >
            🔗 פתח
          </a>
        )}
        <button
          onClick={() => onOpenDetail(job)}
          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ✏️ פרטים
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
        >
          {expanded ? '▲' : '▼'} העבר
        </button>
      </div>

      {/* Move stage dropdown */}
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {stages
            .filter(s => s.id !== job.stage)
            .map(s => (
              <button
                key={s.id}
                onClick={() => { onMove(job.id, s.id); setExpanded(false) }}
                className="text-xs bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950
                           text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-right transition-colors"
              >
                {s.emoji} {s.label}
              </button>
            ))}
          <button
            onClick={() => { onDelete(job.id); setExpanded(false) }}
            className="text-xs bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-600 rounded-lg px-2 py-1 col-span-2"
          >
            🗑️ מחק
          </button>
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  jobs,
  onMove,
  onDelete,
  onOpenDetail,
  allStages,
}: {
  stage:       { id: PipelineStage; label: string; color: string; emoji: string }
  jobs:        PipelineJob[]
  onMove:      (id: string, stage: PipelineStage) => void
  onDelete:    (id: string) => void
  onOpenDetail:(job: PipelineJob) => void
  allStages:   { id: PipelineStage; label: string; emoji: string }[]
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData('jobId')
    if (id) onMove(id, stage.id)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-2xl p-3 min-w-[220px] w-[220px] flex-shrink-0 transition-all
                  ${stage.color}
                  ${dragOver ? 'ring-2 ring-blue-400 scale-[1.01]' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 mb-3">
        <span>{stage.emoji}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{stage.label}</span>
        <span className="ml-auto text-xs font-medium text-gray-500 dark:text-gray-400
                         bg-white dark:bg-gray-900 rounded-full px-2 py-0.5">
          {jobs.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 min-h-[120px]">
        {jobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onMove={onMove}
            onDelete={onDelete}
            onOpenDetail={onOpenDetail}
            stages={allStages}
          />
        ))}
        {jobs.length === 0 && (
          <div className="text-center text-xs text-gray-400 dark:text-gray-600 py-6 border-2 border-dashed
                          border-gray-200 dark:border-gray-700 rounded-xl">
            גרור לכאן
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function DetailModal({
  job,
  onClose,
  onSave,
}: {
  job:     PipelineJob
  onClose: () => void
  onSave:  (updated: PipelineJob) => void
}) {
  const [notes, setNotes] = useState(job.notes ?? '')
  const [stage, setStage] = useState<PipelineStage>(job.stage)

  const allStageOptions: { id: PipelineStage; label: string; emoji: string }[] = [
    ...ACTIVE_STAGES.map(s => ({ id: s.id, label: s.label, emoji: s.emoji })),
    ...CLOSED_STAGES,
  ]

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-5 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
            <p className="text-sm text-gray-500">{job.company} · {job.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Stage selector */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">שלב</label>
          <select
            value={stage}
            onChange={e => setStage(e.target.value as PipelineStage)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                       px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            dir="rtl"
          >
            {allStageOptions.map(s => (
              <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">הערות</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="הערות, תאריכים, שמות מראיינים..."
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                       px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            dir="rtl"
          />
        </div>

        {/* Cover Letter preview */}
        {job.cover_letter && (
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">מכתב מוטיבציה</label>
            <div className="text-xs bg-gray-50 dark:bg-gray-800 rounded-xl p-3 max-h-32 overflow-y-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap" dir="rtl">
              {job.cover_letter}
            </div>
          </div>
        )}

        {/* Links */}
        {job.url && (
          <div className="mb-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline"
            >
              🔗 פתח מודעה
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">ביטול</button>
          <button
            onClick={() => { onSave({ ...job, notes, stage }); onClose() }}
            className="btn-primary"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Job Modal ──────────────────────────────────────────────────────────────

function AddJobModal({ onClose, onAdd }: { onClose: () => void; onAdd: (job: PipelineJob) => void }) {
  const [form, setForm] = useState({ title: '', company: '', location: '', salary: '', url: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    if (!form.title || !form.company) return
    onAdd({
      id:         `manual-${Date.now()}`,
      stage:      'saved',
      added_at:   new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ats_score:  50,
      source:     'manual',
      notes:      '',
      ...form,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 shadow-xl" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">הוסף משרה ידנית</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        {[
          { key: 'title',    label: 'תפקיד *',  placeholder: 'Software Engineer' },
          { key: 'company',  label: 'חברה *',   placeholder: 'Google' },
          { key: 'location', label: 'מיקום',    placeholder: 'Tel Aviv' },
          { key: 'salary',   label: 'שכר',      placeholder: '30,000 ₪' },
          { key: 'url',      label: 'קישור',    placeholder: 'https://...' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="mb-3">
            <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
            <input
              value={form[key as keyof typeof form]}
              onChange={set(key as keyof typeof form)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                         px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        ))}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">ביטול</button>
          <button onClick={handleAdd} className="btn-primary" disabled={!form.title || !form.company}>
            הוסף
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Closed / Archive panel ─────────────────────────────────────────────────────

function ClosedPanel({ jobs }: { jobs: Record<PipelineStage, PipelineJob[]> }) {
  const total = CLOSED_STAGES.reduce((n, s) => n + (jobs[s.id]?.length ?? 0), 0)
  const [open, setOpen] = useState(false)

  if (total === 0) return null

  return (
    <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-2"
      >
        {open ? '▼' : '▶'} ארכיון ({total} משרות)
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {CLOSED_STAGES.map(s => (
            <div key={s.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                {s.emoji} {s.label} ({jobs[s.id]?.length ?? 0})
              </p>
              {(jobs[s.id] ?? []).map(j => (
                <p key={j.id} className="text-xs text-gray-500 dark:text-gray-500 truncate py-0.5">
                  {j.company} · {j.title}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────

function StatsBar({ jobs }: { jobs: PipelineJob[] }) {
  const active  = jobs.filter(j => !CLOSED_STAGES.map(s => s.id).includes(j.stage as any))
  const applied = jobs.filter(j => j.stage !== 'saved' && j.stage !== 'rejected' && j.stage !== 'withdrawn' && j.stage !== 'ghosted')
  const interviews = jobs.filter(j => ['interview', 'technical', 'final_round', 'offer', 'accepted'].includes(j.stage))
  const responseRate = applied.length ? Math.round((interviews.length / applied.length) * 100) : 0

  return (
    <div className="flex gap-4 flex-wrap mb-4">
      {[
        { label: 'פעילות',        value: active.length },
        { label: 'הוגשו',         value: applied.filter(j => j.stage !== 'saved').length },
        { label: 'ראיונות',       value: interviews.length },
        { label: 'שיעור תגובה',   value: `${responseRate}%` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-2 text-center min-w-[80px]">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PipelinePage() {
  const [jobs, setJobs]           = useState<PipelineJob[]>([])
  const [detailJob, setDetailJob] = useState<PipelineJob | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    setJobs(loadJobs())
  }, [])

  const updateJobs = useCallback((updated: PipelineJob[]) => {
    setJobs(updated)
    saveJobs(updated)
  }, [])

  const moveJob = useCallback((id: string, stage: PipelineStage) => {
    setJobs(prev => {
      const updated = prev.map(j =>
        j.id === id ? { ...j, stage, updated_at: new Date().toISOString() } : j
      )
      saveJobs(updated)
      return updated
    })
  }, [])

  const deleteJob = useCallback((id: string) => {
    setJobs(prev => { const u = prev.filter(j => j.id !== id); saveJobs(u); return u })
  }, [])

  const saveDetail = useCallback((updated: PipelineJob) => {
    setJobs(prev => {
      const u = prev.map(j => j.id === updated.id ? updated : j)
      saveJobs(u)
      return u
    })
  }, [])

  const addJob = useCallback((job: PipelineJob) => {
    setJobs(prev => { const u = [job, ...prev]; saveJobs(u); return u })
  }, [])

  const byStage = jobsByStage(jobs)

  const allStageOptions: { id: PipelineStage; label: string; emoji: string }[] = [
    ...ACTIVE_STAGES.map(s => ({ id: s.id, label: s.label, emoji: s.emoji })),
    ...CLOSED_STAGES,
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ניהול בקשות</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{jobs.length} משרות בסה״כ</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            + הוסף ידנית
          </button>
        </div>
        <StatsBar jobs={jobs} />
      </div>

      {/* Kanban Board — horizontally scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto px-4 py-3"
      >
        <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
          {ACTIVE_STAGES.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              jobs={byStage[stage.id] ?? []}
              onMove={moveJob}
              onDelete={deleteJob}
              onOpenDetail={setDetailJob}
              allStages={allStageOptions}
            />
          ))}
        </div>

        {/* Closed / Archive */}
        <div className="mt-4" style={{ minWidth: 'max-content', maxWidth: '100vw' }}>
          <ClosedPanel jobs={byStage} />
        </div>
      </div>

      {/* Modals */}
      {detailJob && (
        <DetailModal
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onSave={saveDetail}
        />
      )}
      {showAdd && (
        <AddJobModal onClose={() => setShowAdd(false)} onAdd={addJob} />
      )}
    </div>
  )
}
