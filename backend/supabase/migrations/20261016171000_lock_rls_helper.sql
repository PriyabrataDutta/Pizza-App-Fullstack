-- rls_auto_enable() is the event-trigger helper Supabase installs for "automatic RLS".
-- It must run only as a trigger, never be callable through the public API (/rest/v1/rpc).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
