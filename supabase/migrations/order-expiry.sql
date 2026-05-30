-- =============================================
-- ShipIQ — Order Auto-Expiry + Notification Dedupe
-- Run this ONCE in the Supabase SQL Editor (you have no DDL access from the app).
--
-- What it does:
--   1. Adds orders.calculated_at (when an order entered 'calculated').
--   2. Backfills it for existing calculated orders.
--   3. Trigger: stamps calculated_at = now() whenever status becomes 'calculated'
--      (covers admin "Save & Notify", bulk status change, and every other path).
--   4. Adds per-customer dedupe markers on profiles.
--   5. Adds config rows to app_settings (admin-editable).
--
-- NOTE on the 'expired' status: orders.status is a plain `text` column with no
-- CHECK constraint or enum, so 'expired' is already a valid value — nothing to
-- alter for validity. (If you ever add a CHECK constraint, include 'expired'.)
-- =============================================

-- 1. Timestamp marking entry into 'calculated'
alter table public.orders
  add column if not exists calculated_at timestamptz;

-- 2. Backfill: assume existing calculated orders started their clock at
--    updated_at (best available signal). Harmless for non-calculated rows.
update public.orders
  set calculated_at = coalesce(calculated_at, updated_at, created_at)
  where status = 'calculated' and calculated_at is null;

-- 3. Stamp calculated_at on transition into 'calculated'. Re-entering
--    'calculated' (e.g. admin re-quotes) restarts the 48h clock, which is the
--    desired behavior (a fresh price = a fresh window).
create or replace function public.stamp_calculated_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'calculated'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.calculated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stamp_calculated_at on public.orders;
create trigger orders_stamp_calculated_at
  before insert or update on public.orders
  for each row execute function public.stamp_calculated_at();

-- 4. Per-customer notification dedupe markers.
--    last_expiry_digest_at — when we last sent this customer a daily digest.
--    last_expiry_urgent_at — when we last sent this customer an urgent (<=4h) ping.
alter table public.profiles
  add column if not exists last_expiry_digest_at timestamptz,
  add column if not exists last_expiry_urgent_at timestamptz;

-- 5. Index to make the cron's "calculated + age" scan cheap.
create index if not exists idx_orders_status_calculated_at
  on public.orders (status, calculated_at);

-- 6. Admin-editable config (key/value, public-readable, admin-writable).
insert into public.app_settings (key, value) values
  ('expiry_window_hours',            '48'),   -- hours from 'calculated' to auto-void
  ('expiry_digest_hour',             '10'),   -- daily digest send hour, Asia/Baghdad (0-23)
  ('expiry_urgent_threshold_hours',  '4'),    -- "soon" window: <= N hours left fires urgent push
  ('expiry_cron_note',               'Hourly Vercel Cron hits /api/cron/order-expiry')
on conflict (key) do nothing;
