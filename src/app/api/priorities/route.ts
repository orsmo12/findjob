import { NextResponse } from 'next/server'
import { getPriorities, setPriorities } from '@/agents/memory-engine'
import { CURRENT_USER_ID } from '@/lib/constants'
import type { DomainPriority } from '@/types'

// Returns the live, feedback-adjusted domain priorities for the current
// (single, fixed) user. The client polls this after feedback so the
// Sidebar/Profile sliders reflect any automatic adjustment the Memory
// Engine made.
export async function GET() {
  const priorities = await getPriorities(CURRENT_USER_ID)
  return NextResponse.json({ priorities })
}

// Used by onboarding (and the Profile page's domain editor) to persist the
// user's chosen domains + scores. Body: { priorities: DomainPriority[] }.
export async function POST(req: Request) {
  const body = await req.json()
  const incoming = (body?.priorities ?? []) as DomainPriority[]
  const priorities = await setPriorities(CURRENT_USER_ID, incoming)
  return NextResponse.json({ priorities })
}
