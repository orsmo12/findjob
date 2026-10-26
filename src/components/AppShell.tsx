'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar, type Page } from '@/components/layout/Sidebar'
import CareerPage from '@/components/career/CareerPage'
import AgentOfficePage from '@/components/career/AgentOfficePage'
import { HomeDashboard }   from '@/components/home/HomeDashboard'
import { ProfilePage }     from '@/components/profile/ProfilePage'
import { PipelinePage }    from '@/components/pipeline/PipelinePage'
import type { BoardStats, DomainPriority } from '@/types'
import { MOCK_PRIORITIES } from '@/lib/mock-data'

const PRIORITIES_KEY = 'lb-priorities'
interface AppShellProps { initialStats: BoardStats }

export function AppShell({ initialStats }: AppShellProps) {
  const [page, setPage]             = useState<Page>('home')
  const [priorities, setPriorities] = useState<DomainPriority[]>(MOCK_PRIORITIES)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRIORITIES_KEY)
      if (saved) setPriorities(JSON.parse(saved))
    } catch {}
  }, [])

  const nav = useCallback((p: Page) => setPage(p), [])

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background:'var(--bg-base)' }}>
      <Sidebar currentPage={page} onNavigate={nav} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:pb-0 pb-16">
        {page === 'home'     && <HomeDashboard   onNavigate={nav} />}
        {page === 'career'   && <CareerPage onNavigate={nav} />}
        {page === 'pipeline' && <PipelinePage />}
        {page === 'office'   && <AgentOfficePage onNavigate={nav} />}
        {page === 'agents'   && <AgentOfficePage onNavigate={nav} />}
        {page === 'profile'  && <ProfilePage     onNavigate={nav} />}
      </main>
    </div>
  )
}
