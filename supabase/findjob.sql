-- findjob — מסד הנתונים. מריצים פעם אחת ב-Supabase: SQL Editor › New query › Run.
-- כל משתמש רואה ומשנה רק את השורות שלו (RLS). הסוכנים בענן עובדים עם המפתח הסודי.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first      text default '',
  name       text default '',
  cv_text    text default '',
  answers    jsonb default '{}'::jsonb,
  team       jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.jobs (
  user_id    uuid references auth.users(id) on delete cascade,
  id         text,
  card       jsonb not null,           -- הכרטיס כפי שהאפליקציה מציגה
  fit        real,
  decision   text,                     -- null / save / skip
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
