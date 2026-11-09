-- findjob: משימות בין סוכנים (סבב 2א). מריצים פעם אחת ב-Supabase: SQL Editor › New query › Run.
-- סוכן שצריך משהו מסוכן אחר יוצר כאן משימה. הסוכן השני מבצע אותה בריצה הקרובה שלו.
-- משימה עם depends_on מחכה שהמשימה הקודמת תסתיים (למשל: מכתב של שי מחכה לסקירה של גיל).

create table if not exists public.agent_tasks (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  job_id      text,                       -- המשרה שהמשימה עליה (אם יש)
  from_agent  text not null,              -- מי ביקש
  to_agent    text not null,              -- מי מבצע
  kind        text not null,              -- brief / prep / letter / tailor
  need        text default '',            -- מה צריך, במילים
  depends_on  bigint references public.agent_tasks(id) on delete set null,
  status      text default 'pending',     -- pending / done / failed
  result      jsonb,                      -- תקציר התוצאה (לא התוצאה המלאה: היא נשמרת במשרה)
  created_at  timestamptz default now(),
  done_at     timestamptz
);
create index if not exists agent_tasks_open on public.agent_tasks (user_id, to_agent, status);

alter table public.agent_tasks enable row level security;
drop policy if exists "own tasks" on public.agent_tasks;
create policy "own tasks" on public.agent_tasks for select using (auth.uid() = user_id);
grant select on public.agent_tasks to authenticated;
grant all on public.agent_tasks to service_role;

-- קובי: התאמת קורות חיים למשרה (הצעות לפני ← אחרי, רק מעובדות שכבר בקורות החיים)
alter table public.jobs add column if not exists tailor jsonb;
