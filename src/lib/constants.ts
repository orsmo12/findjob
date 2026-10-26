// Single, durable, well-known user id for the no-login MVP. Every
// persistence call site (in-memory or Supabase) keys its data on this one
// constant instead of the old literal 'mock-user' string, because a real
// Postgres `uuid` column (see supabase/schema.sql) rejects a non-uuid
// value like 'mock-user'.
//
// Mirrors the seed row in supabase/schema.sql — if you ever change one,
// change the other.
//
// When real Supabase Auth ships, this stops being a constant and becomes
// "whichever id is in the current session" — every call site that imports
// this already takes a userId parameter, so that swap touches this one
// file, not every call site.
export const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001'
