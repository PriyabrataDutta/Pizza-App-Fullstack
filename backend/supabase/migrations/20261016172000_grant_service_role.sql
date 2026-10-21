-- The project was created with "automatically expose new tables" OFF, so no API role can touch these tables.
-- The trusted Next.js server uses the service role; grant it exactly what it needs. anon and authenticated stay locked out.
grant select, insert, update, delete on public.staff_users, public.user_modules, public.audit_log to service_role;
