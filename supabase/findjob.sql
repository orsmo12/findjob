-- findjob — מסד הנתונים. מריצים פעם אחת ב-Supabase: SQL Editor › New query › Run.
-- כל משתמש רואה ומשנה רק את השורות שלו (RLS). הסוכנים בענן עובדים עם המפתח הסודי.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first      text default '',
  name       text default '',
  cv_text    text default '',
  answers    jsonb default '{}'::jsonb,
  team       jsonb default '{}'::jsonb,
  state      jsonb default '{}'::jsonb,  -- הגשות, משימות וסיפורים מהאפליקציה
  updated_at timestamptz default now()
);

create table if not exists public.jobs (
  user_id    uuid references auth.users(id) on delete cascade,
  id         text,
  card       jsonb not null,           -- הכרטיס כפי שהאפליקציה מציגה
  fit        real,
  decision   text,                     -- null / save / skip
  letter     jsonb,                    -- מכתב הפנייה של שי: {text, lang, checked}
  created_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  agent      text default 'hunter',
  stats      jsonb,
  plan       jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.jobs     enable row level security;
alter table public.runs     enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own jobs" on public.jobs;
create policy "own jobs" on public.jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own runs" on public.runs;
create policy "own runs" on public.runs for select using (auth.uid() = user_id);

-- אם הטבלאות נוצרו בגרסה קודמת:
alter table public.profiles add column if not exists state jsonb default '{}'::jsonb;
alter table public.jobs     add column if not exists letter jsonb;

-- הרשאות ל-API (אם "Automatically expose new tables" כבוי)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.jobs to authenticated;
grant select on public.runs to authenticated;
grant all on public.profiles, public.jobs, public.runs to service_role;
alter table public.jobs add column if not exists brief jsonb;   -- גיל: סקירת חברה עם מקורות
alter table public.jobs add column if not exists prep jsonb;    -- מאיה: שאלות הכנה
alter table public.profiles add column if not exists li jsonb default '{}'::jsonb;  -- קובי ומאיה: פוסטים, טיוטה, שיפורים
alter table public.profiles add column if not exists li_text text default '';        -- טקסט מ-PDF של פרופיל ה-LinkedIn
alter table public.profiles add column if not exists li_fixes jsonb default '{}'::jsonb;  -- מאיה: שיפורי פרופיל
