-- Home-screen offer banners (the sideways-scrolling cards on the app's Home screen), edited in the dashboard under Offers.
-- A banner is marketing content, not a product: a headline, one line of detail, an optional coupon code to show, an optional picture,
-- and an optional schedule. Apply AFTER the two 20261027 launch-readiness migrations; additive only.
-- Like every table: reachable only from the trusted server (service role). RLS on, no policies.

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  detail text not null default '' check (length(detail) <= 200),
  -- Shown on the banner; the server still validates the code when an order is placed. Not a foreign key: a banner can announce a code
  -- that is created later, and deleting a coupon must not delete the banner.
  coupon_code text null check (coupon_code is null or coupon_code ~ '^[A-Z0-9_-]{3,30}$'),
  image_path text null,                       -- path inside the product-images bucket (promotions/...)
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index promotions_active_sort_idx on public.promotions (sort_order, created_at) where is_active;

create trigger promotions_touch before update on public.promotions for each row execute function public.touch_updated_at();

alter table public.promotions enable row level security;
revoke all on public.promotions from anon, authenticated;
grant select, insert, update, delete on public.promotions to service_role;

-- Starter content: the offers printed on the menu. Edit, hide or delete them in the dashboard. Only inserted into an empty table.
insert into public.promotions (title, detail, sort_order)
select * from (values
  ('Angebot 1 · 25 €', '2 große Pizzen oder 2 Nudelgerichte, kleiner Salat, Pizzabrötchen und 1 l Getränk.', 1),
  ('Angebot 2 · 42 €', '4 große Pizzen, großer Salat, Pizzabrötchen und 1 l Getränk.', 2),
  ('Pizzablech ab 24 €', '60 x 40 cm: Margherita 24 €, mit 2 Zutaten 28 €.', 3),
  ('1 l Getränk gratis', 'Ab 30 € Bestellwert gibt es ein alkoholfreies Getränk (1 l) dazu.', 4)
) as starter(title, detail, sort_order)
where not exists (select 1 from public.promotions);
