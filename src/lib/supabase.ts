import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Dual-path persistence gate. Every persistence module (memory-engine.ts,
// weekly-snapshot.ts, profile-store.ts, and the API routes that touch
// board_items directly) checks isSupabaseConfigured() before deciding
// whether to read/write Supabase or fall back to its in-memory store.
//
// The client itself is created lazily, on first real use, rather than at
// module load — the previous version of this file did
// `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)` at the top
// level, which throws immediately on import if the env vars are unset
// (createClient validates the URL). That's incompatible with "the app must
// stay usable with zero Supabase credentials" — this module must always be
// safe to import, even when nothing is configured.

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon)
}

let cached: SupabaseClient | null = null

/** Returns the (memoized) Supabase client, or null if not configured.
 * Never throws — callers should branch on isSupabaseConfigured() first, or
 * just null-check the return value, and fall back to in-memory state. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!cached) cached = createClient(url as string, anon as string)
  return cached
}
