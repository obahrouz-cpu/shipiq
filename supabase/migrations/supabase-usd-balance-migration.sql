-- ── USD wallet balance + Iraqi payment methods ───────────────────────────────
-- Adds a USD-denominated balance to profiles and a USD column to the
-- transaction ledger. The legacy `profiles.balance` (IQD) and
-- `transactions.amount` (IQD) columns are retained for backwards compatibility.

-- 1. USD balance on profiles (canonical going forward)
alter table public.profiles
  add column if not exists balance_usd numeric not null default 0;

-- 2. USD amount on the transaction ledger (positive = top-up, negative = deduction)
alter table public.transactions
  add column if not exists amount_usd numeric;

-- 3. Backfill USD balance from any existing IQD balance (one-time, ~1540 IQD/USD).
--    Only touches rows that have not been migrated yet.
update public.profiles
  set balance_usd = round(balance / 1540.0, 2)
  where balance_usd = 0 and balance > 0;
