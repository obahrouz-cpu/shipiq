-- =============================================
-- ShipIQ Database Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text,
  phone text,
  role text not null default 'customer', -- 'customer' or 'admin'
  balance bigint not null default 0,     -- stored in IQD (Iraqi Dinar)
  tier text not null default 'bronze',   -- customer loyalty tier (bronze/silver/gold/platinum/vip)
  total_spent numeric not null default 0,-- lifetime USD spent (sum of shipping_price / 1450 for confirmed+ orders)
  created_at timestamptz default now()
);

-- Orders table
create table public.orders (
  id text primary key default ('ORD-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  user_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  description text not null,
  category text not null default 'Other',
  qty int not null default 1,
  item_price numeric,
  item_price_currency text default 'USD',
  note text,
  photo_url text,
  urgency boolean default false,
  status text not null default 'pending',
  -- 'pending' | 'calculated' | 'confirmed' | 'shipped' | 'rejected'
  shipping_price bigint,                 -- in IQD
  shipping_currency text default 'IQD',
  weight text,
  reject_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transactions table (balance history)
create table public.transactions (
  id text primary key default ('TXN-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount bigint not null,               -- positive = top-up, negative = deduction
  currency text default 'IQD',
  note text,
  order_id text references public.orders(id),
  created_at timestamptz default now()
);

-- ── Auto-create profile on signup ──────────────────────────
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

-- ── Auto-update updated_at on orders ──────────────────────
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

-- ── Row Level Security ─────────────────────────────────────

-- Profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Orders
alter table public.orders enable row level security;

create policy "Customers see their own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Customers can insert their own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all orders"
  on public.orders for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all orders"
  on public.orders for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Transactions
alter table public.transactions enable row level security;

create policy "Users see their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Admins can manage all transactions"
  on public.transactions for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Storage bucket for order photos ───────────────────────
insert into storage.buckets (id, name, public)
values ('order-photos', 'order-photos', true);

create policy "Anyone can upload order photos"
  on storage.objects for insert
  with check (bucket_id = 'order-photos');

create policy "Anyone can view order photos"
  on storage.objects for select
  using (bucket_id = 'order-photos');

-- ── Tier settings ─────────────────────────────────────────
-- Populated by the admin UI; queried by the recalculate function
-- create table public.tier_settings (
--   tier       text primary key,
--   name_en    text,
--   name_ar    text,
--   min_spend  numeric,
--   color      text,
--   icon       text,
--   benefits   text,
--   is_active  boolean default true
-- );

-- ── total_spent trigger ────────────────────────────────────
-- See supabase-tier-migration.sql for the full trigger definition.
-- The trigger fires on INSERT/UPDATE/DELETE on orders and calls
-- recalculate_total_spent(user_id), which sums shipping_price/1450
-- (IQD→USD) for all confirmed/ordered/warehouse/transit/arrived/delivered
-- orders and updates profiles.total_spent + profiles.tier accordingly.

-- ── Make yourself admin ────────────────────────────────────
-- After you sign up, run this with YOUR email:
-- update public.profiles set role = 'admin' where email = 'your@email.com';
