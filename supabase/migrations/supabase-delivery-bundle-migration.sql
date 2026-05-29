-- ─────────────────────────────────────────────────────────────────────────────
-- Delivery bundle migration
-- Run this once in the Supabase SQL Editor.
--
-- Covers the move from per-order, per-city delivery (Erbil/Baghdad IQD fees,
-- office pickup) to a single delivery-only bundle flow with a flat USD fee.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Flat nationwide delivery fee (USD). The app reads this from app_settings.
--    getDeliveryFeeUsd() falls back to 4 if the row is missing, so this is just
--    an explicit seed. Adjust the value any time from the admin Pricing tab.
insert into public.app_settings (key, value, updated_at)
values ('delivery_flat_fee_usd', '4', now())
on conflict (key) do nothing;

-- 2) Convert legacy delivery_requests fees from IQD → USD.
--    New bundles are written by createDeliveryBundle() with
--    delivery_preference = 'home' and the fee already in USD, so they are
--    excluded. The `delivery_fee > 100` guard makes this idempotent: converted
--    values are single digits, so re-running the script won't double-convert.
--    1540 = the IQD_PER_USD rate the old per-city fees were expressed in.
update public.delivery_requests
set delivery_fee = round(delivery_fee / 1540.0, 2)
where delivery_preference is distinct from 'home'
  and delivery_fee > 100;

-- 3) Allow a customer to dispatch their OWN arrived orders into a bundle.
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
