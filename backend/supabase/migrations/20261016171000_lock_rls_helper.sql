-- rls_auto_enable() is the event-trigger helper Supabase installs for "automatic RLS".
-- It must run only as a trigger, never be callable through the public API (/rest/v1/rpc).
-- A project created without that option has no such function, so the statement only runs when it exists
-- (the first project had it; a project created later for the move to Frankfurt did not).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
