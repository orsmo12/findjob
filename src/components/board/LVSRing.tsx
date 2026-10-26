'use client'

import { useLanguage } from '@/lib/language-context'

interface LVSRingProps {
  score: number
  size?: 'sm' | 'md'
}

export function LVSRing({ score, size = 'md' }: LVSRingProps) {
  const { t } = useLanguage()
  const dim   = size === 'sm' ? 34 : 44
  const r     = size === 'sm' ? 12 : 16
  const circ  = 2 * Math.PI * r
  const fill  = (score / 100) * circ
  const sw    = size === 'sm' ? 2 : 2.5
  const fs    = size === 'sm' ? 9 : 11

  const color =
    score >= 80 ? '#16a34a' :
    score >= 60 ? '#d97706' :
    '#dc2626'

  return (
    <div className="flex flex-col items-center gap-0.5 cursor-help" title={t('tooltip.lvs')}>
      <div style={{ width: dim, height: dim, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none" stroke="var(--color-track, #e5e7eb)" strokeWidth={sw}
          />
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={`${fill.toFixed(1)} ${circ.toFixed(1)}`}
            strokeLinecap="round"
            opacity={0.9}
          />
        </svg>
        <span style={{ fontSize: fs, fontWeight: 700, color: 'inherit', position: 'relative', zIndex: 1 }}>
          {score}
        </span>
      </div>
      {size === 'md' && (
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#9ca3af' }}>
          LVS
        </span>
      )}
    </div>
  )
}
