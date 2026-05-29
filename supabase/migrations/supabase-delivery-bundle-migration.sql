-- ─────────────────────────────────────────────────────────────────────────────
-- Delivery bundle migration
-- Run this once in the Supabase SQL Editor.
--
-- Covers the move from per-order, per-city delivery (Erbil/Baghdad fees, office
-- pickup) to a single delivery-only bundle flow with a flat IQD fee that is paid
-- in cash on handover or deducted from balance.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Flat nationwide delivery fee (IQD). The app reads this from app_settings.
--    getDeliveryFeeIqd() falls back to 5000 if the row is missing, so this is just
--    an explicit seed. Adjust the value any time from the admin Pricing tab.
insert into public.app_settings (key, value, updated_at)
values ('delivery_flat_fee_iqd', '5000', now())
on conflict (key) do nothing;

-- 2) Allow a customer to dispatch their OWN arrived orders into a bundle.
--    orders previously had only an admin UPDATE policy; the customer-side
--    "Deliver my products" confirm needs to move arrived → out_for_delivery.
--    This policy is tightly scoped: only the owner, only rows currently
--    'arrived', and only to set status = 'out_for_delivery'. (Mirrors the
--    existing client-trust model used for profiles.balance_usd.)
drop policy if exists "Customers can dispatch own arrived orders" on public.orders;
create policy "Customers can dispatch own arrived orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'arrived')
  with check (auth.uid() = user_id and status = 'out_for_delivery');

-- Note on payment method: a bundle's delivery_fee is stored in IQD, and the
-- (legacy) delivery_preference column records how it's paid — 'cash' (collect on
-- handover) or 'balance' (already deducted). No schema change needed.
