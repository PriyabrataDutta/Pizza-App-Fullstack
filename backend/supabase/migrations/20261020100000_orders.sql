-- Checkout and orders for Crust & Co. Design: docs/checkout-implementation-plan.md.
--   * Guest checkout with a device token: customers hold only a HASH of their token.
--   * An order is a snapshot (names, sizes, option names and prices are copied), so later menu edits never change it.
--   * place_order() writes an order, its lines, history, payment and coupon use in ONE transaction and is idempotent.
--   * advance_order_status() allows only the lifecycle in docs/order-lifecycle.md and writes history with every change.
-- Like every table so far, these are reachable only from the trusted Next.js server (service role). RLS is on with no policies.
-- Money is integer cents. Menu prices include VAT, so no tax is added on top (tax_minor stays 0 for now).
-- Payments are simulated: no card data is ever stored, and payment rows are always marked demo.

-- ---------------------------------------------------------------------------------------------------------------
-- Customers (guests) and their addresses
-- ---------------------------------------------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'), -- SHA-256 of the device token; the token itself is never stored
  full_name text null,
  phone text null,
  auth_user_id uuid null unique references auth.users (id) on delete set null, -- set when a guest later signs in
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  line1 text not null check (length(trim(line1)) > 0),
  locality text not null check (length(trim(locality)) > 0),
  city text not null check (length(trim(city)) > 0),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  instructions text null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_customer_idx on public.customer_addresses (customer_id);
create unique index customer_addresses_one_default_uidx on public.customer_addresses (customer_id) where is_default;

-- ---------------------------------------------------------------------------------------------------------------
-- Where we deliver, and the minimum order for each area
-- ---------------------------------------------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  postal_codes text[] not null check (cardinality(postal_codes) > 0),
  minimum_order_minor bigint not null default 0 check (minimum_order_minor >= 0),
  delivery_fee_minor bigint not null default 0 check (delivery_fee_minor >= 0),
  estimated_minutes integer not null default 35 check (estimated_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_type text not null check (discount_type in ('fixed', 'percentage')),
  discount_value bigint not null check (discount_value > 0),
  minimum_order_minor bigint not null default 0 check (minimum_order_minor >= 0),
  maximum_discount_minor bigint null check (maximum_discount_minor is null or maximum_discount_minor > 0),
  starts_at timestamptz null,
  expires_at timestamptz null,
  usage_limit integer null check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer null check (per_customer_limit is null or per_customer_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Orders and their snapshots
-- ---------------------------------------------------------------------------------------------------------------
create sequence public.order_number_seq start with 1050;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  status text not null default 'placed' check (status in (
    'placed', 'accepted', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'
  )),
  payment_method text not null check (payment_method in ('cod', 'online_demo')),
  payment_status text not null check (payment_status in ('pending', 'demo_paid', 'paid')),
  currency char(3) not null default 'EUR',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  delivery_fee_minor bigint not null default 0 check (delivery_fee_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  coupon_id uuid null references public.coupons (id) on delete set null,
  coupon_code text null,
  delivery_zone_id uuid null references public.delivery_zones (id) on delete set null,
  estimated_minutes integer null,
  -- address snapshot
  delivery_label text not null,
  delivery_line1 text not null,
  delivery_locality text not null,
  delivery_city text not null,
  delivery_postal_code text not null,
  delivery_instructions text null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (discount_minor <= subtotal_minor),
  check (total_minor = subtotal_minor - discount_minor + tax_minor + delivery_fee_minor)
);

create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid null references public.products (id) on delete set null,
  portion_key text not null,
  product_name text not null,
  portion_label text not null,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  currency char(3) not null default 'EUR',
  created_at timestamptz not null default now(),
  check (line_total_minor = unit_price_minor * quantity)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  option_id uuid null references public.options (id) on delete set null,
  group_name text not null,
  option_name text not null,
  price_minor bigint not null default 0 check (price_minor >= 0)
);

create index order_item_options_item_idx on public.order_item_options (order_item_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  previous_status text null,
  new_status text not null,
  actor_staff_id uuid null references public.staff_users (id) on delete set null,
  actor_label text not null default 'system',
  reason text null,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null check (method in ('cod', 'online_demo')),
  status text not null check (status in ('pending', 'demo_paid', 'paid')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'EUR',
  is_demo boolean not null default true check (is_demo), -- payments are simulated; a real gateway needs its own review
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  discount_minor bigint not null check (discount_minor >= 0),
  created_at timestamptz not null default now()
);

create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id, customer_id);

-- ---------------------------------------------------------------------------------------------------------------
-- Lifecycle (docs/order-lifecycle.md). The restaurant may cancel from accepted or preparing; customers cannot cancel yet.
-- ---------------------------------------------------------------------------------------------------------------
create function public.order_transition_allowed(old_status text, new_status text) returns boolean
language sql immutable set search_path = '' as $$
  select (old_status, new_status) in (
    ('placed', 'accepted'), ('placed', 'rejected'),
    ('accepted', 'preparing'), ('accepted', 'cancelled'),
    ('preparing', 'ready_for_dispatch'), ('preparing', 'cancelled'),
    ('ready_for_dispatch', 'out_for_delivery'),
    ('out_for_delivery', 'delivered')
  );
$$;

create function public.advance_order_status(p_order uuid, p_new text, p_actor_staff uuid, p_actor_label text, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_old text;
begin
  select status into v_old from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND: that order does not exist';
  end if;
  if not public.order_transition_allowed(v_old, p_new) then
    raise exception 'INVALID_TRANSITION: an order that is % cannot become %', v_old, p_new;
  end if;
  update public.orders set status = p_new where id = p_order;
  insert into public.order_status_history (order_id, previous_status, new_status, actor_staff_id, actor_label, reason)
  values (p_order, v_old, p_new, p_actor_staff, coalesce(nullif(p_actor_label, ''), 'staff'), nullif(p_reason, ''));
  -- Cash is collected when the food arrives.
  if p_new = 'delivered' then
    update public.payments set status = 'paid' where order_id = p_order and method = 'cod' and status = 'pending';
    update public.orders set payment_status = 'paid' where id = p_order and payment_method = 'cod' and payment_status = 'pending';
  end if;
  return jsonb_build_object('order_id', p_order, 'previous_status', v_old, 'status', p_new);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Checkout: one transaction. The server computes every price and passes the finished snapshot; this function stores it,
-- enforces coupon limits under a row lock, and makes a retry with the same key return the same order.
-- ---------------------------------------------------------------------------------------------------------------
create function public.place_order(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_customer uuid := (p->>'customer_id')::uuid;
  v_key text := p->>'idempotency_key';
  v_method text := p->>'payment_method';
  v_coupon uuid := nullif(p->>'coupon_id', '')::uuid;
  v_discount bigint := coalesce((p->>'discount_minor')::bigint, 0);
  v_total bigint := (p->>'total_minor')::bigint;
  v_existing uuid;
  v_order uuid;
  v_item jsonb;
  v_opt jsonb;
  v_item_id uuid;
  v_coupon_row public.coupons%rowtype;
  v_used integer;
begin
  select id into v_existing from public.orders where customer_id = v_customer and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('order_id', v_existing, 'created', false);
  end if;

  if v_coupon is not null then
    select * into v_coupon_row from public.coupons where id = v_coupon for update;
    if not found or not v_coupon_row.is_active then
      raise exception 'COUPON_INVALID: that code is not valid anymore';
    end if;
    if v_coupon_row.usage_limit is not null then
      select count(*) into v_used from public.coupon_redemptions where coupon_id = v_coupon;
      if v_used >= v_coupon_row.usage_limit then
        raise exception 'COUPON_LIMIT: that offer has been used up';
      end if;
    end if;
    if v_coupon_row.per_customer_limit is not null then
      select count(*) into v_used from public.coupon_redemptions where coupon_id = v_coupon and customer_id = v_customer;
      if v_used >= v_coupon_row.per_customer_limit then
        raise exception 'COUPON_LIMIT: you have already used that offer';
      end if;
    end if;
  end if;

  insert into public.orders (
    order_number, customer_id, payment_method, payment_status, currency, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor,
    total_minor, coupon_id, coupon_code, delivery_zone_id, estimated_minutes,
    delivery_label, delivery_line1, delivery_locality, delivery_city, delivery_postal_code, delivery_instructions, idempotency_key
  ) values (
    'CC-' || nextval('public.order_number_seq'), v_customer, v_method,
    case when v_method = 'online_demo' then 'demo_paid' else 'pending' end,
    coalesce(p->>'currency', 'EUR'), (p->>'subtotal_minor')::bigint, v_discount, coalesce((p->>'tax_minor')::bigint, 0),
    coalesce((p->>'delivery_fee_minor')::bigint, 0), v_total, v_coupon, nullif(p->>'coupon_code', ''),
    nullif(p->>'delivery_zone_id', '')::uuid, nullif(p->>'estimated_minutes', '')::integer,
    p#>>'{address,label}', p#>>'{address,line1}', p#>>'{address,locality}', p#>>'{address,city}', p#>>'{address,postal_code}',
    nullif(p#>>'{address,instructions}', ''), v_key
  ) returning id into v_order;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (order_id, product_id, portion_key, product_name, portion_label, quantity, unit_price_minor, line_total_minor, currency)
    values (
      v_order, nullif(v_item->>'product_id', '')::uuid, v_item->>'portion_key', v_item->>'product_name', v_item->>'portion_label',
      (v_item->>'quantity')::integer, (v_item->>'unit_price_minor')::bigint, (v_item->>'line_total_minor')::bigint, coalesce(p->>'currency', 'EUR')
    ) returning id into v_item_id;
    for v_opt in select * from jsonb_array_elements(coalesce(v_item->'options', '[]'::jsonb)) loop
      insert into public.order_item_options (order_item_id, option_id, group_name, option_name, price_minor)
      values (v_item_id, nullif(v_opt->>'option_id', '')::uuid, v_opt->>'group_name', v_opt->>'option_name', coalesce((v_opt->>'price_minor')::bigint, 0));
    end loop;
  end loop;

  insert into public.order_status_history (order_id, previous_status, new_status, actor_label) values (v_order, null, 'placed', 'customer');
  insert into public.payments (order_id, method, status, amount_minor, currency)
  values (v_order, v_method, case when v_method = 'online_demo' then 'demo_paid' else 'pending' end, v_total, coalesce(p->>'currency', 'EUR'));
  if v_coupon is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_id, discount_minor) values (v_coupon, v_order, v_customer, v_discount);
  end if;
  return jsonb_build_object('order_id', v_order, 'created', true);
exception when unique_violation then
  -- A concurrent request with the same idempotency key won the race: return its order.
  select id into v_existing from public.orders where customer_id = v_customer and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('order_id', v_existing, 'created', false);
  end if;
  raise;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reference data: delivery areas (from the printed menu) and demo coupons.
-- The outer-district postcodes are an assumption for the restaurant to confirm.
-- ---------------------------------------------------------------------------------------------------------------
insert into public.delivery_zones (name, postal_codes, minimum_order_minor, delivery_fee_minor, estimated_minutes) values
  ('Wesel-Mitte', array['46483'], 1000, 0, 35),
  ('Blumenkamp, Schornacker, Flüren', array['46485', '46487'], 2000, 0, 45)
on conflict (name) do nothing;

insert into public.coupons (code, discount_type, discount_value, minimum_order_minor, maximum_discount_minor, is_active) values
  ('WELCOME5', 'fixed', 500, 2000, null, true),
  ('PIZZA2', 'fixed', 200, 1200, null, true),
  ('FEAST10', 'percentage', 10, 3000, 1000, true),
  ('WINTER15', 'percentage', 15, 2500, 1000, false)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- updated_at, and lock everything down: server (service role) only.
-- ---------------------------------------------------------------------------------------------------------------
create trigger customer_addresses_touch before update on public.customer_addresses for each row execute function public.touch_updated_at();
create trigger delivery_zones_touch before update on public.delivery_zones for each row execute function public.touch_updated_at();
create trigger coupons_touch before update on public.coupons for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;

revoke all on
  public.customers, public.customer_addresses, public.delivery_zones, public.coupons, public.orders, public.order_items,
  public.order_item_options, public.order_status_history, public.payments, public.coupon_redemptions
from anon, authenticated;

grant select, insert, update, delete on
  public.customers, public.customer_addresses, public.delivery_zones, public.coupons, public.orders, public.order_items,
  public.order_item_options, public.order_status_history, public.payments, public.coupon_redemptions
to service_role;
grant usage, select on sequence public.order_number_seq to service_role;

revoke execute on function
  public.order_transition_allowed(text, text), public.advance_order_status(uuid, text, uuid, text, text), public.place_order(jsonb)
from anon, authenticated, public;
grant execute on function
  public.order_transition_allowed(text, text), public.advance_order_status(uuid, text, uuid, text, text), public.place_order(jsonb)
to service_role;
