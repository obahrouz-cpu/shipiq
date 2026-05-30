-- =============================================
-- Order Auto-Expiry + Batched Push Notifications
-- Run this in the Supabase SQL Editor.
-- Idempotent — safe to re-run.
-- =============================================

-- ── 1. 'expired' as a terminal order status ──────────────────────────────────
-- public.orders.status is a free-text column in this schema (no CHECK/enum),
-- so 'expired' is already an accepted value and nothing needs to change for the
-- default schema. The block below is defensive: IF you have since wrapped
-- status in a CHECK constraint, drop+recreate it to include 'expired' (and the
-- other terminal statuses). It no-ops when no such constraint exists.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
    execute $ck$
      alter table public.orders add constraint orders_status_check
      check (status in (
        'pending','calculated','confirmed','ordered','warehouse','transit',
        'arrived','out_for_delivery','delivered','rejected','cancelled','expired'
      ))
    $ck$;
  end loop;
end $$;

-- ── 2. calculated_at timestamp ───────────────────────────────────────────────
-- Marks when an order entered 'calculated'. The cron ages orders out from this.
alter table public.orders
  add column if not exists calculated_at timestamptz;

-- Backfill existing calculated orders so the cron can age them out immediately.
-- updated_at is the best available proxy for when they were calculated.
update public.orders
  set calculated_at = coalesce(calculated_at, updated_at, created_at)
  where status = 'calculated' and calculated_at is null;

-- Stamp calculated_at automatically on EVERY transition into 'calculated',
-- no matter which code path does it (admin handleCalculate, bulk status edit,
-- agent, API). This is the authoritative source of the timestamp.
create or replace function public.stamp_calculated_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'calculated' and (old.status is distinct from 'calculated') then
    new.calculated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stamp_calculated_at on public.orders;
create trigger orders_stamp_calculated_at
  before update on public.orders
  for each row execute function public.stamp_calculated_at();

-- Partial index — the cron only ever scans calculated orders by this column.
create index if not exists idx_orders_calculated_at
  on public.orders(calculated_at) where status = 'calculated';

-- ── 3. Per-customer notification dedupe markers ──────────────────────────────
-- One marker per notification type, on profiles. See the cron route for how
-- these guarantee "once per day" (digest) and "once per window-entry" (urgent).
alter table public.profiles
  add column if not exists last_expiry_digest_at timestamptz,
  add column if not exists last_expiry_urgent_at timestamptz;

-- ── 4. Admin-editable config (app_settings key/value rows) ───────────────────
-- Editable from Admin → Settings → Order Expiry. Defaults seeded here; existing
-- values are preserved (on conflict do nothing).
insert into public.app_settings (key, value) values
  ('expiry_window_hours', '48'),
  ('expiry_digest_hour',  '10'),
  ('expiry_urgent_hours', '4'),
  ('expiry_cron_note',    'Hourly cron. Auto-voids calculated orders older than the window (sets status=expired, no push). Sends ONE urgent push per customer per entry into the urgent window, and ONE daily digest at the digest hour (Asia/Baghdad).')
on conflict (key) do nothing;
