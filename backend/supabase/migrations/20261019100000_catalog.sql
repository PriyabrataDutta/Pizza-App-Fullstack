-- Dynamic catalog for Crust & Co.: categories, products, portions, extras and choices.
-- Design: docs/catalog-implementation-plan.md (section 3). A category is only a container; everything that varies
-- (portions, extras, choices, prices, filters, images) is data, so a new category needs no code change.
--
-- Three kinds of customer decision are kept apart:
--   portion  the priced base of a product (Klein / Groß / Maxi, 0,33 l, 6 Stück)         -> product_portions
--   extra    an optional add-on that costs money, which can depend on the portion         -> option_groups.kind = 'extra'
--   choice   a free selection that changes the dish but not the price (pasta shape)       -> option_groups.kind = 'choice'
--
-- Like the access tables, everything here is reachable only from the trusted Next.js server (service role).
-- RLS is on with no policies, so the anon and authenticated roles can read and write nothing.
-- Money is integer minor units (cents) plus a currency code. Never use floating point.

-- ---------------------------------------------------------------------------------------------------------------
-- Portion templates: reusable size sets ("Pizza sizes", "Drink sizes") that a category offers when adding products.
-- ---------------------------------------------------------------------------------------------------------------
create table public.portion_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portion_set_items (
  set_id uuid not null references public.portion_sets (id) on delete cascade,
  -- Stable code that prices are matched on (klein, gross, maxi, 0_33l, standard). Never shown to customers.
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  primary key (set_id, key)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Categories (at most two levels) and products.
-- ---------------------------------------------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_path text null,           -- path inside the product-images bucket
  icon_key text null,             -- a name from a fixed list the app knows; optional
  sort_order integer not null default 0,
  is_active boolean not null default true,
  default_portion_set_id uuid null references public.portion_sets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index categories_parent_sort_idx on public.categories (parent_id, sort_order);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_path text null,
  diet text not null check (diet in ('veg', 'non_veg')),
  is_spicy boolean not null default false,
  is_bestseller boolean not null default false,
  is_new boolean not null default false,
  allergens text[] not null default '{}',
  -- pickup_only items (alcohol) are never offered for delivery.
  fulfillment text not null default 'delivery_and_pickup' check (fulfillment in ('delivery_and_pickup', 'pickup_only')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_sort_idx on public.products (category_id, sort_order);
create index products_active_idx on public.products (is_active) where is_active;

-- Search by name or description. pg_trgm makes "ilike '%curry%'" use an index.
create extension if not exists pg_trgm with schema extensions;
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_description_trgm_idx on public.products using gin (description extensions.gin_trgm_ops);

-- Extra filters that need no app update (vegan, gluten_free). Diet and spicy stay as columns: every product has them.
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0
);

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Portions: the priced base of a product. Every active product needs at least one available portion
-- (enforced by the server, because a database check cannot see a child table).
-- ---------------------------------------------------------------------------------------------------------------
create table public.product_portions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(trim(label)) > 0),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null default 'EUR',
  sku text null,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, key)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Extras and choices. Groups and options are defined once and reused (the ingredient "Salami" exists once).
-- ---------------------------------------------------------------------------------------------------------------
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  kind text not null check (kind in ('extra', 'choice')),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_select >= min_select),
  check (not is_required or min_select >= 1)
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Used only when no price is set for the attachment and portion. Always 0 for 'choice' groups.
  default_price_minor bigint not null default 0 check (default_price_minor >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

-- Where a group applies: to every product of a category, or to a single product.
-- A product attachment for a group overrides the category attachment for the same group.
create table public.group_attachments (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('category', 'product')),
  category_id uuid null references public.categories (id) on delete cascade,
  product_id uuid null references public.products (id) on delete cascade,
  group_id uuid not null references public.option_groups (id) on delete restrict,
  sort_order integer not null default 0,
  default_option_id uuid null references public.options (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'category' and category_id is not null and product_id is null) or
    (scope = 'product' and product_id is not null and category_id is null)
  )
);

create unique index group_attachments_category_uidx on public.group_attachments (category_id, group_id) where scope = 'category';
create unique index group_attachments_product_uidx on public.group_attachments (product_id, group_id) where scope = 'product';
create index group_attachments_group_idx on public.group_attachments (group_id);

-- Price of an extra for one attachment, optionally for one portion key.
-- portion_key null means "any portion". Lookup order (first match wins), done by the server:
--   product attachment + portion, product attachment + any, category attachment + portion, category attachment + any,
--   then options.default_price_minor.
create table public.option_prices (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.group_attachments (id) on delete cascade,
  option_id uuid not null references public.options (id) on delete cascade,
  portion_key text null check (portion_key is null or portion_key ~ '^[a-z0-9_]+$'),
  price_minor bigint not null check (price_minor >= 0)
);

create unique index option_prices_uidx on public.option_prices (attachment_id, option_id, coalesce(portion_key, '*'));
create index option_prices_option_idx on public.option_prices (option_id);

-- ---------------------------------------------------------------------------------------------------------------
-- Rules a plain check cannot express.
-- ---------------------------------------------------------------------------------------------------------------

-- Categories are at most two levels deep: a parent must be a top-level category, and a category that has
-- children cannot itself become a child.
create function public.check_category_depth() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
      raise exception 'CATEGORY_DEPTH: categories can be nested one level only';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'CATEGORY_DEPTH: a category with sub-categories cannot become a sub-category';
    end if;
  end if;
  return new;
end $$;

create trigger categories_check_depth before insert or update of parent_id on public.categories
for each row execute function public.check_category_depth();

-- Free 'choice' groups never cost money: refuse prices on their options.
create function public.check_choice_options_are_free() returns trigger
language plpgsql set search_path = '' as $$
declare
  group_kind text;
begin
  if tg_table_name = 'options' then
    select kind into group_kind from public.option_groups where id = new.group_id;
    if group_kind = 'choice' and new.default_price_minor <> 0 then
      raise exception 'CHOICE_PRICE: options of a choice group must be free';
    end if;
  else
    select g.kind into group_kind
    from public.options o join public.option_groups g on g.id = o.group_id
    where o.id = new.option_id;
    if group_kind = 'choice' and new.price_minor <> 0 then
      raise exception 'CHOICE_PRICE: options of a choice group must be free';
    end if;
  end if;
  return new;
end $$;

create trigger options_check_free before insert or update on public.options
for each row execute function public.check_choice_options_are_free();
create trigger option_prices_check_free before insert or update on public.option_prices
for each row execute function public.check_choice_options_are_free();

-- An option price must be for an option of the attached group; a default option must belong to the attached group.
create function public.check_attachment_options() returns trigger
language plpgsql set search_path = '' as $$
declare
  attached_group uuid;
  option_group uuid;
begin
  if tg_table_name = 'option_prices' then
    select group_id into attached_group from public.group_attachments where id = new.attachment_id;
    select group_id into option_group from public.options where id = new.option_id;
    if attached_group is distinct from option_group then
      raise exception 'OPTION_NOT_IN_GROUP: that option does not belong to the attached group';
    end if;
  elsif new.default_option_id is not null then
    select group_id into option_group from public.options where id = new.default_option_id;
    if option_group is distinct from new.group_id then
      raise exception 'OPTION_NOT_IN_GROUP: the default option does not belong to the attached group';
    end if;
  end if;
  return new;
end $$;

create trigger option_prices_check_group before insert or update on public.option_prices
for each row execute function public.check_attachment_options();
create trigger group_attachments_check_default before insert or update on public.group_attachments
for each row execute function public.check_attachment_options();

-- ---------------------------------------------------------------------------------------------------------------
-- updated_at, and a catalog version the app and API use for caching (ETag, 304 Not Modified).
-- touch_updated_at() already exists from the RBAC migration.
-- ---------------------------------------------------------------------------------------------------------------
create trigger portion_sets_touch before update on public.portion_sets for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger product_portions_touch before update on public.product_portions for each row execute function public.touch_updated_at();
create trigger option_groups_touch before update on public.option_groups for each row execute function public.touch_updated_at();
create trigger options_touch before update on public.options for each row execute function public.touch_updated_at();
create trigger group_attachments_touch before update on public.group_attachments for each row execute function public.touch_updated_at();

create table public.catalog_meta (
  id smallint primary key default 1 check (id = 1),
  version bigint not null default 1
);
insert into public.catalog_meta (id, version) values (1, 1);

create function public.bump_catalog_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.catalog_meta set version = version + 1 where id = 1;
  return null;
end $$;

create trigger portion_sets_bump after insert or update or delete on public.portion_sets for each statement execute function public.bump_catalog_version();
create trigger portion_set_items_bump after insert or update or delete on public.portion_set_items for each statement execute function public.bump_catalog_version();
create trigger categories_bump after insert or update or delete on public.categories for each statement execute function public.bump_catalog_version();
create trigger products_bump after insert or update or delete on public.products for each statement execute function public.bump_catalog_version();
create trigger tags_bump after insert or update or delete on public.tags for each statement execute function public.bump_catalog_version();
create trigger product_tags_bump after insert or update or delete on public.product_tags for each statement execute function public.bump_catalog_version();
create trigger product_portions_bump after insert or update or delete on public.product_portions for each statement execute function public.bump_catalog_version();
create trigger option_groups_bump after insert or update or delete on public.option_groups for each statement execute function public.bump_catalog_version();
create trigger options_bump after insert or update or delete on public.options for each statement execute function public.bump_catalog_version();
create trigger group_attachments_bump after insert or update or delete on public.group_attachments for each statement execute function public.bump_catalog_version();
create trigger option_prices_bump after insert or update or delete on public.option_prices for each statement execute function public.bump_catalog_version();

-- ---------------------------------------------------------------------------------------------------------------
-- Lock everything down: server (service role) only.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.portion_sets enable row level security;
alter table public.portion_set_items enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.product_portions enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.group_attachments enable row level security;
alter table public.option_prices enable row level security;
alter table public.catalog_meta enable row level security;

revoke all on
  public.portion_sets, public.portion_set_items, public.categories, public.products, public.tags, public.product_tags,
  public.product_portions, public.option_groups, public.options, public.group_attachments, public.option_prices,
  public.catalog_meta
from anon, authenticated;

grant select, insert, update, delete on
  public.portion_sets, public.portion_set_items, public.categories, public.products, public.tags, public.product_tags,
  public.product_portions, public.option_groups, public.options, public.group_attachments, public.option_prices,
  public.catalog_meta
to service_role;

revoke execute on function
  public.check_category_depth(), public.check_choice_options_are_free(), public.check_attachment_options(),
  public.bump_catalog_version()
from anon, authenticated, public;

-- ---------------------------------------------------------------------------------------------------------------
-- Photos. The bucket is public for reading (the app loads images by URL). There are no storage policies, so only the
-- server, using signed upload URLs it creates for permitted dashboard users, can write.
-- ---------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
