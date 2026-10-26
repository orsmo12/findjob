/**
 * Profile store
 *
 * /api/run-agents previously built a literal hardcoded UserProfile object
 * inline on every request ("Mock user profile (replace with real profile
 * from DB in production)"). This module is that replacement: dual-path
 * persistence (Supabase when configured, in-memory otherwise) seeded with
 * the exact same default values, so moving to a real row changes nothing
 * about what the app shows — only where the data lives.
 *
 * There's currently no UI that edits these fields (ProfilePage renders
 * static, translated read-only labels) — setProfile() exists for
 * completeness/forward-compatibility (mirrors getPriorities/setPriorities'
 * shape) but nothing calls it yet.
 */

import type { UserProfile } from '@/types'
import { isSupabaseConfigured, getSupabase } from './supabase'

const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Alex Kim',
  email: 'alex@example.com',
  profession: 'Software Engineer',
  location: 'Tel Aviv, Israel',
  skills: ['Python', 'TypeScript', 'React', 'ML basics'],
}

function defaultProfileFor(userId: string): UserProfile {
  return { id: userId, created_at: '', updated_at: '', ...DEFAULT_PROFILE }
}

// In-memory fallback, keyed by user id — same pattern as memory-engine.ts's stores.
const profileStore: Record<string, UserProfile> = {}

export async function getProfile(userId: string): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      if (data) return data as UserProfile

      // No row yet — seed it (schema.sql also seeds this row for the fixed
      // user id, so in practice this only fires for an id schema.sql wasn't
      // run against, or a brand new user id).
      const seeded = defaultProfileFor(userId)
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(seeded)
        .select('*')
        .single()
      if (insertError) throw insertError
      return (inserted as UserProfile) ?? seeded
    } catch (err) {
      console.error('[profile-store] Supabase read/seed failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  if (!profileStore[userId]) {
    profileStore[userId] = defaultProfileFor(userId)
  }
  return profileStore[userId]
}

export async function setProfile(userId: string, updates: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single()
      if (error) throw error
      return data as UserProfile
    } catch (err) {
      console.error('[profile-store] Supabase update failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  const current = profileStore[userId] ?? defaultProfileFor(userId)
  profileStore[userId] = { ...current, ...updates }
  return profileStore[userId]
}
