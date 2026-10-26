import { AppShell } from '@/components/AppShell'
import { MOCK_STATS } from '@/lib/mock-data'

// Server component — loads initial board data before render.
// Item/goal/memory content is language-dependent (Hebrew/English) and the
// chosen language lives in localStorage, so AppShell selects that data
// client-side via useLanguage(). Only the language-independent stats are
// passed down from here.
export default async function HomePage() {
  return <AppShell initialStats={MOCK_STATS} />
}
