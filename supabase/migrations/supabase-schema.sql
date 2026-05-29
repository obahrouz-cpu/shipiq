-- =============================================
-- ShipIQ Database Schema — Full Reference
-- Run this in Supabase SQL Editor (fresh DB)
-- For an existing DB, run the individual
-- migration files instead.
-- =============================================

-- ── Profiles (extends auth.users) ────────────────────────────────────────────
create table public.profiles (
  id                  uuid references auth.users on delete cascade primary key,
  full_name           text not null,
  email               text,
  phone               text,
  role                text not null default 'customer',   -- 'customer' | 'admin' | 'agent'
  language            text default 'en',                   -- 'en' | 'ar'
  balance             bigint not null default 0,           -- IQD (legacy)
  balance_usd         numeric not null default 0,           -- USD (canonical wallet balance)
  tier                text not null default 'silver',
  total_spent         numeric not null default 0,          -- lifetime USD (shipping / 1450)
  assigned_country    text,                                -- agent only: 'USA' | 'Turkey' | 'UAE' | 'China'
  delivery_lat        double precision,
  delivery_lng        double precision,
  delivery_address    text,
  delivery_city       text,
  delivery_notes      text,
  is_suspended        boolean default false,
  suspension_reason   text,
  last_seen_at        timestamptz,
  created_at          timestamptz default now()
);

-- ── Orders ────────────────────────────────────────────────────────────────────
create table public.orders (
  id                        text primary key default ('ORD-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  user_id                   uuid references public.profiles(id) on delete cascade not null,
  url                       text not null,
  description               text not null,
  category                  text not null default 'Other',
  qty                       int not null default 1,
  item_price                numeric,
  item_price_currency       text default 'USD',
  note                      text,
  photo_url                 text,
  urgency                   boolean default false,
  status                    text not null default 'pending',
  -- pending | calculated | confirmed | ordered | warehouse | transit | arrived | out_for_delivery | delivered | rejected
  shipping_price            bigint,                        -- IQD
  shipping_currency         text default 'IQD',
  service_fee               bigint default 0,              -- IQD
  customs_fee               bigint default 0,              -- IQD
  delivery_fee              bigint default 0,              -- IQD
  total_cost                bigint default 0,              -- IQD (shipping + service + customs + delivery)
  total_charged             bigint,                        -- IQD actually charged from balance
  is_charged                boolean default false,
  charged_at                timestamptz,
  weight                    text,
  reject_reason             text,
  delivery_preference       text,
  delivery_city             text,
  country_origin            text,
  agent_receipt_url         text,
  agent_warehouse_photo_url text,
  ordered_at                timestamptz,
  warehoused_at             timestamptz,
  wave_invoice_id           text,
  wave_synced_at            timestamptz,
  wave_sync_status          text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ── Transactions (balance history) ───────────────────────────────────────────
create table public.transactions (
  id         text primary key default ('TXN-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  user_id    uuid references public.profiles(id) on delete cascade not null,
  amount     bigint not null,              -- positive = top-up, negative = deduction (IQD, legacy)
  amount_usd numeric,                       -- positive = top-up, negative = deduction (USD)
  currency   text default 'IQD',
  note       text,
  order_id   text references public.orders(id),
  created_at timestamptz default now()
);

-- ── Tier settings ─────────────────────────────────────────────────────────────
create table public.tier_settings (
  tier       text primary key,             -- 'silver' | 'gold' | 'diamond' | 'platinum' | 'titanium'
  name_en    text,
  name_ar    text,
  min_spend  numeric not null default 0,   -- minimum lifetime USD spend to reach this tier
  color      text,
  icon       text,
  benefits   text,
  is_active  boolean default true
);

-- Default tiers
insert into public.tier_settings (tier, name_en, name_ar, min_spend, color, icon, benefits) values
  ('silver',   'Silver',   'فضي',      0,    '#C0C0C0', '⭐', ''),
  ('gold',     'Gold',     'ذهبي',     500,  '#FFD700', '🥇', ''),
  ('diamond',  'Diamond',  'ماسي',     1000, '#B9F2FF', '💎', ''),
  ('platinum', 'Platinum', 'بلاتيني',  2000, '#E5E4E2', '👑', ''),
  ('titanium', 'Titanium', 'تيتانيوم', 3000, '#878681', '🔱', '');

-- ── App settings (key/value store) ───────────────────────────────────────────
create table public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- ── Wishlist ──────────────────────────────────────────────────────────────────
create table public.wishlist (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  url         text not null,
  description text,
  photo_url   text,
  notes       text,
  created_at  timestamptz default now()
);

-- ── Delivery requests ─────────────────────────────────────────────────────────
create table public.delivery_requests (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references public.profiles(id) on delete cascade not null,
  order_ids           text[] not null,                     -- array of order IDs included in this request
  delivery_preference text not null,                       -- 'pickup' | 'home_delivery'
  delivery_city       text,
  delivery_address    text,
  delivery_lat        double precision,
  delivery_lng        double precision,
  delivery_notes      text,
  delivery_fee        bigint not null default 0,           -- IQD
  status              text not null default 'pending',     -- 'pending' | 'out_for_delivery' | 'completed' | 'cancelled'
  scheduled_at        timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now()
);

-- ── Notifications ─────────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  title      text not null,
  message    text not null,
  type       text not null default 'info',                 -- 'info' | 'success' | 'warning' | 'error'
  read       boolean not null default false,
  created_at timestamptz default now()
);

-- ── Order notes (admin ↔ customer messaging) ──────────────────────────────────
create table public.order_notes (
  id                   uuid default gen_random_uuid() primary key,
  order_id             text references public.orders(id) on delete cascade not null,
  user_id              uuid references public.profiles(id) on delete cascade not null,
  message              text not null,
  is_admin             boolean not null default false,
  is_read_by_customer  boolean not null default false,
  is_read_by_admin     boolean not null default false,
  created_at           timestamptz default now()
);

-- ── Customer admin notes (internal, never shown to customer) ──────────────────
create table public.customer_admin_notes (
  id          uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  admin_id    uuid references public.profiles(id) on delete set null,
  note        text not null,
  created_at  timestamptz default now()
);

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update orders.updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure update_updated_at();

-- Recalculate total_spent + tier when orders change
create or replace function recalculate_total_spent(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_spent numeric;
  v_tier        text;
begin
  select coalesce(sum(shipping_price::numeric / 1450.0), 0)
  into v_total_spent
  from public.orders
  where user_id     = p_user_id
    and status      in ('confirmed','ordered','warehouse','transit','arrived','delivered')
    and shipping_price is not null
    and shipping_price > 0;

  begin
    select tier into v_tier
    from public.tier_settings
    where is_active = true and min_spend <= v_total_spent
    order by min_spend desc limit 1;
  exception when undefined_table then v_tier := null;
  end;

  update public.profiles
  set total_spent = v_total_spent, tier = coalesce(v_tier, 'silver')
  where id = p_user_id;
end;
$$;

create or replace function trigger_recalculate_total_spent()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('confirmed','ordered','warehouse','transit','arrived','delivered') then
      perform recalculate_total_spent(new.user_id);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.shipping_price is distinct from old.shipping_price then
      if new.status in ('confirmed','ordered','warehouse','transit','arrived','delivered')
      or old.status in ('confirmed','ordered','warehouse','transit','arrived','delivered') then
        perform recalculate_total_spent(new.user_id);
        if new.user_id is distinct from old.user_id then
          perform recalculate_total_spent(old.user_id);
        end if;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status in ('confirmed','ordered','warehouse','transit','arrived','delivered') then
      perform recalculate_total_spent(old.user_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists orders_total_spent_trigger on public.orders;
create trigger orders_total_spent_trigger
  after insert or update or delete on public.orders
  for each row execute function trigger_recalculate_total_spent();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_orders_user_id         on public.orders(user_id);
create index if not exists idx_orders_status           on public.orders(status);
create index if not exists idx_orders_created_at       on public.orders(created_at desc);
create index if not exists idx_transactions_user_id    on public.transactions(user_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
create index if not exists idx_notifications_user_id   on public.notifications(user_id);
create index if not exists idx_notifications_read      on public.notifications(user_id, read) where read = false;
create index if not exists idx_order_notes_order_id    on public.order_notes(order_id);
create index if not exists idx_order_notes_user_id     on public.order_notes(user_id);
create index if not exists idx_wishlist_user_id        on public.wishlist(user_id);
create index if not exists idx_delivery_requests_user  on public.delivery_requests(user_id);
create index if not exists idx_customer_admin_notes    on public.customer_admin_notes(customer_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

-- Profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update all profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Orders
alter table public.orders enable row level security;

create policy "Customers see own orders"
  on public.orders for select using (auth.uid() = user_id);

create policy "Customers can insert own orders"
  on public.orders for insert with check (auth.uid() = user_id);

create policy "Admins can view all orders"
  on public.orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update all orders"
  on public.orders for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Agents can view assigned country orders"
  on public.orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'agent'));

-- Transactions
alter table public.transactions enable row level security;

create policy "Users see own transactions"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Admins can manage all transactions"
  on public.transactions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Tier settings (read-only for customers)
alter table public.tier_settings enable row level security;

create policy "Anyone can read tier settings"
  on public.tier_settings for select using (true);

create policy "Admins can manage tier settings"
  on public.tier_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- App settings (read-only for customers)
alter table public.app_settings enable row level security;

create policy "Anyone can read app settings"
  on public.app_settings for select using (true);

create policy "Admins can manage app settings"
  on public.app_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Wishlist
alter table public.wishlist enable row level security;

create policy "Users manage own wishlist"
  on public.wishlist for all using (auth.uid() = user_id);

-- Delivery requests
alter table public.delivery_requests enable row level security;

create policy "Users see own delivery requests"
  on public.delivery_requests for select using (auth.uid() = user_id);

create policy "Users can create delivery requests"
  on public.delivery_requests for insert with check (auth.uid() = user_id);

create policy "Admins can manage all delivery requests"
  on public.delivery_requests for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Notifications
alter table public.notifications enable row level security;

create policy "Users see own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Admins can manage all notifications"
  on public.notifications for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Order notes
alter table public.order_notes enable row level security;

create policy "Users see notes for own orders"
  on public.order_notes for select
  using (auth.uid() = user_id or exists (
    select 1 from public.orders where id = order_notes.order_id and user_id = auth.uid()
  ));

create policy "Users can insert notes for own orders"
  on public.order_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.order_notes for update using (auth.uid() = user_id);

create policy "Admins can manage all order notes"
  on public.order_notes for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Customer admin notes
alter table public.customer_admin_notes enable row level security;

create policy "Admins can manage customer notes"
  on public.customer_admin_notes for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Storage ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('order-photos', 'order-photos', true)
  on conflict (id) do nothing;

create policy "Anyone can upload order photos"
  on storage.objects for insert with check (bucket_id = 'order-photos');

create policy "Anyone can view order photos"
  on storage.objects for select using (bucket_id = 'order-photos');

-- ── Post-setup: make yourself admin ──────────────────────────────────────────
-- After signing up, run in SQL Editor:
-- update public.profiles set role = 'admin' where email = 'your@email.com';
