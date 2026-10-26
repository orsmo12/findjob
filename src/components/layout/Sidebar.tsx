'use client'

/**
 * Sidebar / Bottom Nav — Life Building
 *
 * Desktop: fixed left column (w-20 collapsed, w-56 expanded)
 * Mobile:  fixed bottom bar
 */

import { useState } from 'react'

export type Page = 'home' | 'career' | 'pipeline' | 'office' | 'domains' | 'profile' | 'agents'

interface NavItem {
  id: Page
  icon: string
  label: string
  color?: string
  dot?: string
}

interface SidebarProps {
  currentPage: Page
  onNavigate:  (page: Page) => void
  activeDomains?: { id: Page; label: string; color: string; icon: string }[]
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm text-white"
        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
        LB
      </div>
      <span className="hidden lg:block text-sm font-bold text-white whitespace-nowrap">Life Building</span>
    </div>
  )
}

function SideItem({ item, active, onClick }:
  { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all relative group"
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
      }}
    >
      <span className="text-xl w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{ background: active ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
        {item.icon}
      </span>
      <span className={`hidden lg:block text-sm font-semibold whitespace-nowrap ${
        active ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white'
      }`}>
        {item.label}
      </span>
      {item.dot && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full hidden lg:block"
          style={{ background: item.dot }} />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
          style={{ background: item.color ?? '#6366f1' }} />
      )}
    </button>
  )
}

function BottomItem({ item, active, onClick }:
  { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 py-2 transition-all"
    >
      <span className={`text-xl transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
        {item.icon}
      </span>
      <span className={`text-[9px] font-bold transition-colors ${
        active ? 'text-indigo-400' : 'text-slate-600'
      }`}>
        {item.label}
      </span>
      {active && <span className="w-1 h-1 rounded-full bg-indigo-400" />}
    </button>
  )
}

export function Sidebar({ currentPage, onNavigate, activeDomains = [] }: SidebarProps) {
  const FIXED_BOTTOM: NavItem[] = [
    { id: 'office',  icon: '🏢', label: 'עובדים' },
    { id: 'profile', icon: '👤', label: 'פרופיל' },
  ]

  const domainItems: NavItem[] = activeDomains.length > 0
    ? activeDomains.map(d => ({ id: d.id, icon: d.icon, label: d.label, color: d.color, dot: d.color }))
    : [{ id: 'career', icon: '💼', label: 'קריירה', color: '#6366f1', dot: '#6366f1' }]

  const allItems: NavItem[] = [
    { id: 'home',     icon: '🏠', label: 'בית' },
    ...domainItems,
    { id: 'pipeline', icon: '📋', label: 'בקשות', color: '#10b981', dot: '#10b981' },
    ...FIXED_BOTTOM,
  ]

  const mobileItems = allItems.slice(0, 5)

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col gap-1 py-4 px-2 flex-shrink-0"
        style={{
          width: '72px',
          background: '#0a0d1a',
          borderRight: '1px solid rgba(99,102,241,0.1)',
        }}>
        <div className="mb-4 px-1">
          <LogoMark />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          {allItems.map(item => (
            <SideItem
              key={item.id}
              item={item}
              active={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex"
        style={{
          background: 'rgba(10,13,26,0.97)',
          borderTop: '1px solid rgba(99,102,241,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          backdropFilter: 'blur(12px)',
        }}>
        {mobileItems.map(item => (
          <BottomItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>
    </>
  )
}
