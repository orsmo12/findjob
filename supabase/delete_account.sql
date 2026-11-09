-- findjob (סבב 11): "מחק את החשבון והנתונים שלי". מריצים פעם אחת ב-SQL Editor.
-- המשתמש יכול למחוק רק את עצמו (auth.uid()). כל הטבלאות מחוברות ל-auth.users עם on delete cascade,
-- אז פרופיל, משרות, ריצות ומשימות נמחקים יחד איתו.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
