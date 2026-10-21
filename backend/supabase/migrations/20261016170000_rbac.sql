-- RBAC for the Crust & Co. admin dashboard.
-- Roles: super_admin > manager > staff. Modules are assigned per user by a super admin.
-- Identity lives in Supabase Auth (auth.users); these tables hold the app profile, module grants and audit trail.
-- Tables are reachable only from the trusted Next.js server (service role). RLS is on with no policies,
-- so the anon/authenticated roles can read and write nothing.

create table public.staff_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null unique,
  role text not null check (role in ('super_admin', 'manager', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  must_change_password boolean not null default true,
  branch_id uuid null, -- reserved for future multi-branch scope; unused while there is one outlet
  created_by uuid null references public.staff_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_users_role_status_idx on public.staff_users (role, status);

create table public.user_modules (
  user_id uuid not null references public.staff_users (id) on delete cascade,
  module text not null check (module in (
    'overview', 'orders', 'menu', 'categories', 'customers', 'offers', 'delivery', 'reports', 'settings'
  )),
  access text not null check (access in ('view', 'manage')),
  primary key (user_id, module)
);

-- Super admins implicitly have every module with manage access, so they get no rows here.
-- The 'users' (Users & Access) module is deliberately not assignable.

-- Audit trail. No foreign keys: history must survive deletion of the people it mentions.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null,
  actor_email text null,
  action text not null,
  target_id uuid null,
  target_email text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- Keep updated_at fresh.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger staff_users_touch before update on public.staff_users
for each row execute function public.touch_updated_at();

-- Database-level guard: there must always be at least one active super admin.
create function public.protect_last_super_admin() returns trigger
language plpgsql set search_path = '' as $$
declare
  others integer;
begin
  if old.role = 'super_admin' and old.status = 'active' then
    if tg_op = 'DELETE'
       or new.role <> 'super_admin'
       or new.status <> 'active' then
      select count(*) into others
      from public.staff_users
      where role = 'super_admin' and status = 'active' and id <> old.id;
      if others = 0 then
        raise exception 'LAST_SUPER_ADMIN: at least one active super admin is required';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger staff_users_protect_last_super_admin
before update or delete on public.staff_users
for each row execute function public.protect_last_super_admin();

-- Lock everything down: server (service role) only.
alter table public.staff_users enable row level security;
alter table public.user_modules enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.staff_users, public.user_modules, public.audit_log from anon, authenticated;
revoke execute on function public.touch_updated_at(), public.protect_last_super_admin() from anon, authenticated, public;
