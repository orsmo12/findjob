/**
 * Week range helpers for the "Weekly Brief" primary layer.
 *
 * Life Board's primary board is framed as a weekly intelligence briefing
 * (not a real-time feed) — it shows a Monday-start week range and a
 * generated timestamp, e.g. "Week of June 15–21, 2026" / bilingual
 * "Generated on June 22, 2026".
 *
 * Honest scope note: this computes the *display* framing (the week the
 * brief is "for", and when it was generated) from the current date. It
 * does not implement an actual server-side cron that regenerates the
 * brief every Monday at midnight — Life Board is a local, zero-cost
 * Next.js app with no hosted scheduler. The brief regenerates whenever
 * the user hits Refresh, and always frames itself by the *current* week.
 */

import type { Lang } from './i18n'

export interface WeekRange {
  start: string   // ISO date string, Monday 00:00 local
  end: string     // ISO date string, Sunday 23:59:59 local
  label: string    // bilingual display label, e.g. "Week of June 15–21, 2026"
}

// Shape returned by POST /api/run-agents' `week` field — WeekRange plus a
// generated timestamp/label. Shared here (rather than declared locally in
// AppShell/BoardPage/ExplorePage) since multiple page components now read
// this same state after the Explore & Expand nav split.
export interface WeekInfo extends WeekRange {
  generated_at: string
  generated_label: string
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function monthName(monthIndex: number, lang: Lang): string {
  return (lang === 'he' ? MONTHS_HE : MONTHS_EN)[monthIndex]
}

/** Monday-start week containing `date`. */
export function getWeekRange(date: Date, lang: Lang): WeekRange {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday … 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(d.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
    label: formatWeekLabel(monday, sunday, lang),
  }
}

function formatWeekLabel(start: Date, end: Date, lang: Lang): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()

  if (lang === 'he') {
    return sameMonth
      ? `שבוע ${start.getDate()}–${end.getDate()} ב${monthName(start.getMonth(), lang)} ${end.getFullYear()}`
      : `שבוע ${start.getDate()} ב${monthName(start.getMonth(), lang)} – ${end.getDate()} ב${monthName(end.getMonth(), lang)} ${end.getFullYear()}`
  }

  return sameMonth
    ? `Week of ${monthName(start.getMonth(), lang)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `Week of ${monthName(start.getMonth(), lang)} ${start.getDate()} – ${monthName(end.getMonth(), lang)} ${end.getDate()}, ${end.getFullYear()}`
}

export function formatGeneratedLabel(date: Date, lang: Lang): string {
  const m = monthName(date.getMonth(), lang)
  return lang === 'he'
    ? `נוצר ב-${date.getDate()} ב${m} ${date.getFullYear()}`
    : `Generated on ${m} ${date.getDate()}, ${date.getFullYear()}`
}
