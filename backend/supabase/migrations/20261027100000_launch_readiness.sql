-- Launch readiness for Crust & Co. Design: docs/production-readiness-review.md (sections 1 and 3).
-- ADDITIVE ONLY: nothing is dropped, renamed or made stricter for existing rows, so the code already running keeps working
-- before and after this is applied. Later releases start to use the new columns and tables.
--
--   * orders: contact name and phone (a delivery needs them)
--   * customers: block flag, for abuse
--   * customer_devices: one customer, many devices; a lost phone can be revoked (customers.token_hash stays until the code moved over)
--   * VAT rate per product, copied onto each order line (menu prices include VAT; invoices need the split by rate)
--   * restaurant_settings and opening_hours: open/closed switch, preparation time, weekly hours
--   * rate_limit_hit(): a limiter all server instances share (an in-memory counter does not work on serverless)
--   * indexes on foreign keys that had none
-- As with every table so far: reachable only from the trusted server (service role); RLS on, no policies.

-- ---------------------------------------------------------------------------------------------------------------
-- Orders: who to call. Nullable, because orders placed before this change have none and the old app sends none.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.orders
  add column contact_name text null check (contact_name is null or length(trim(contact_name)) between 1 and 80),
  add column contact_phone text null check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()/-]{6,20}$');

-- ---------------------------------------------------------------------------------------------------------------
-- Customers: blocking, and devices
-- ---------------------------------------------------------------------------------------------------------------
alter table public.customers
  add column is_blocked boolean not null default false,
  add column blocked_reason text null,
  add column blocked_at timestamptz null;

create table public.customer_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index customer_devices_customer_idx on public.customer_devices (customer_id);

-- Every existing guest has exactly one device: the token they already hold.
insert into public.customer_devices (customer_id, token_hash, created_at, last_used_at)
select id, token_hash, created_at, last_seen_at from public.customers
on conflict (token_hash) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- VAT. The rate is set per product by the restaurant with its tax adviser; no rate is assumed here.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.products
  add column vat_rate numeric(4, 2) null check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 30));
alter table public.order_items
  add column vat_rate numeric(4, 2) null check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 30)),
  add column vat_minor bigint null check (vat_minor is null or vat_minor >= 0);

-- ---------------------------------------------------------------------------------------------------------------
-- Restaurant settings (one row) and opening hours
-- ---------------------------------------------------------------------------------------------------------------
create table public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Crust & Co. Pizza House',
  time_zone text not null default 'Europe/Berlin',
  -- The master switch: when false, no new orders are accepted whatever the opening hours say.
  accepting_orders boolean not null default true,
  closed_message text not null default '',
  -- Added to a zone's estimate while the kitchen is busy.
  extra_prep_minutes integer not null default 0 check (extra_prep_minutes between 0 and 180),
  -- When false the opening hours below are ignored (useful while testing).
  enforce_opening_hours boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.restaurant_settings (id) values (1);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7), -- 1 = Monday ... 7 = Sunday
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at), -- a late-night shift past midnight is entered as two rows
  unique (weekday, opens_at)
);

-- ---------------------------------------------------------------------------------------------------------------
-- A rate limiter that every server instance shares.
-- Counts hits per key in fixed windows. One atomic statement: two instances cannot both take the last slot.
-- ---------------------------------------------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- Old windows are removed now and then, so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Foreign keys without an index: deleting a parent row scans the child table, and reports group by these columns.
-- ---------------------------------------------------------------------------------------------------------------
create index order_items_product_idx on public.order_items (product_id) where product_id is not null;
create index order_item_options_option_idx on public.order_item_options (option_id) where option_id is not null;
create index group_attachments_default_option_idx on public.group_attachments (default_option_id) where default_option_id is not null;
create index categories_default_portion_set_idx on public.categories (default_portion_set_id) where default_portion_set_id is not null;
create index orders_delivery_zone_idx on public.orders (delivery_zone_id) where delivery_zone_id is not null;
create index orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;
create index coupon_redemptions_customer_idx on public.coupon_redemptions (customer_id);
create index order_status_history_actor_idx on public.order_status_history (actor_staff_id) where actor_staff_id is not null;

-- ---------------------------------------------------------------------------------------------------------------
-- updated_at, and lock everything down: server (service role) only.
-- ---------------------------------------------------------------------------------------------------------------
create trigger restaurant_settings_touch before update on public.restaurant_settings for each row execute function public.touch_updated_at();

alter table public.customer_devices enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.opening_hours enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.customer_devices, public.restaurant_settings, public.opening_hours, public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.customer_devices, public.restaurant_settings, public.opening_hours, public.rate_limits to service_role;

revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated, public;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
