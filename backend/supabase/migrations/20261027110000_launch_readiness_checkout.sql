-- Launch readiness, part 2: checkout uses the new columns. Apply AFTER 20261027100000_launch_readiness.sql.
-- Still compatible with the code that is running now: an order without contact details or VAT works exactly as before.
--   * place_order() stores the contact name and phone and each line's VAT, and refuses a blocked customer
--   * a deferred check that an order's subtotal equals the sum of its lines (the server is trusted, the database now verifies it too)
--   * restaurant_settings.require_contact_details: when on, checkout refuses an order without a name and phone

alter table public.restaurant_settings
  add column require_contact_details boolean not null default false;

-- ---------------------------------------------------------------------------------------------------------------
-- An order must add up. Checked when the transaction commits, after place_order() has written the lines.
-- ---------------------------------------------------------------------------------------------------------------
create function public.check_order_adds_up() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_sum bigint;
begin
  select coalesce(sum(line_total_minor), 0) into v_sum from public.order_items where order_id = new.id;
  if v_sum <> new.subtotal_minor then
    raise exception 'ORDER_TOTAL_MISMATCH: the lines add up to % but the subtotal is %', v_sum, new.subtotal_minor;
  end if;
  return null;
end $$;

create constraint trigger orders_check_adds_up after insert on public.orders
deferrable initially deferred for each row execute function public.check_order_adds_up();

revoke execute on function public.check_order_adds_up() from anon, authenticated, public;

-- ---------------------------------------------------------------------------------------------------------------
-- place_order(): same contract as before, plus contact details, VAT and the block check.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.place_order(p jsonb) returns jsonb
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

  if exists (select 1 from public.customers where id = v_customer and is_blocked) then
    raise exception 'CUSTOMER_BLOCKED: orders from this customer are not accepted';
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
    delivery_label, delivery_line1, delivery_locality, delivery_city, delivery_postal_code, delivery_instructions, idempotency_key,
    contact_name, contact_phone
  ) values (
    'CC-' || nextval('public.order_number_seq'), v_customer, v_method,
    case when v_method = 'online_demo' then 'demo_paid' else 'pending' end,
    coalesce(p->>'currency', 'EUR'), (p->>'subtotal_minor')::bigint, v_discount, coalesce((p->>'tax_minor')::bigint, 0),
    coalesce((p->>'delivery_fee_minor')::bigint, 0), v_total, v_coupon, nullif(p->>'coupon_code', ''),
    nullif(p->>'delivery_zone_id', '')::uuid, nullif(p->>'estimated_minutes', '')::integer,
    p#>>'{address,label}', p#>>'{address,line1}', p#>>'{address,locality}', p#>>'{address,city}', p#>>'{address,postal_code}',
    nullif(p#>>'{address,instructions}', ''), v_key,
    nullif(trim(p->>'contact_name'), ''), nullif(trim(p->>'contact_phone'), '')
  ) returning id into v_order;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (order_id, product_id, portion_key, product_name, portion_label, quantity, unit_price_minor, line_total_minor, currency, vat_rate, vat_minor)
    values (
      v_order, nullif(v_item->>'product_id', '')::uuid, v_item->>'portion_key', v_item->>'product_name', v_item->>'portion_label',
      (v_item->>'quantity')::integer, (v_item->>'unit_price_minor')::bigint, (v_item->>'line_total_minor')::bigint, coalesce(p->>'currency', 'EUR'),
      nullif(v_item->>'vat_rate', '')::numeric, nullif(v_item->>'vat_minor', '')::bigint
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
