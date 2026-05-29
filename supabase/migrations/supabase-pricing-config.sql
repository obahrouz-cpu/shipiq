-- =============================================
-- ShipIQ — Configurable Pricing Engine
-- Run this ONCE in the Supabase SQL Editor.
-- (You have no DDL access from the app — this is admin-only.)
--
-- One row per origin country. Rates are edited from the admin
-- "Pricing" tab and read by BOTH the website and the Flutter app,
-- so the two can never diverge. All amounts are in `currency` (USD).
-- =============================================

create table if not exists public.pricing_config (
  country                  text primary key,                    -- 'USA' | 'UAE' | 'Turkey' | 'China'
  currency                 text        not null default 'USD',
  weight_unit              text        not null default 'kg',   -- 'lb' (USA) | 'kg' (others)

  -- ── Shipping ── per-unit rate; flat for the whole country, or per-category when toggled on
  shipping_per_category    boolean     not null default false,
  shipping_flat_rate       numeric     not null default 0,      -- per weight-unit (used when per_category = false)
  shipping_category_rates  jsonb       not null default '{}'::jsonb,  -- { cosmetics, supplements, clothing, electronics, accessories, uncategorized }
  min_billable_weight      numeric     not null default 0,      -- floor in weight_unit (one per country); 0 = no minimum

  -- Existing DBs: run this once to add the column without recreating the table —
  --   alter table public.pricing_config add column if not exists min_billable_weight numeric not null default 0;

  -- ── Service fee ── admin picks ONE mode
  service_fee_mode         text        not null default 'percentage',  -- 'percentage' | 'per_piece'
  service_fee_percent      numeric     not null default 0,      -- percentage mode: % of item price
  service_fee_min          numeric     not null default 0,      -- percentage mode: internal floor (applied only after a price exists)
  service_fee_per_piece    numeric     not null default 0,      -- per_piece mode: flat amount × qty

  -- ── Customs ── flat per country, or per-category amounts when toggled on
  customs_per_category     boolean     not null default false,
  customs_flat             numeric     not null default 0,      -- used when per_category = false
  customs_category_amounts jsonb       not null default '{}'::jsonb,

  -- ── Insurance ── admin-set %, customer opts in at order time; % of item price only
  insurance_percent        numeric     not null default 0,

  updated_at               timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Rates are not secret: anyone (incl. logged-out calculator users + Flutter) can
-- READ. Only admins can WRITE. Mirrors the app_settings / tier_settings pattern.
alter table public.pricing_config enable row level security;

drop policy if exists "Anyone can read pricing config"  on public.pricing_config;
create policy "Anyone can read pricing config"
  on public.pricing_config for select using (true);

drop policy if exists "Admins can manage pricing config" on public.pricing_config;
create policy "Admins can manage pricing config"
  on public.pricing_config for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Seed rows ─────────────────────────────────────────────────────────────────
-- USA   — per lb, FLAT shipping 6.00/lb; service fee 4% (set the minimum in the tab).
-- UAE   — per kg, PER-CATEGORY shipping (cosmetics 7.25, supplements 35.00,
--         clothing 3.50, electronics 10.00, accessories 3.50, uncategorized 3.50).
-- Turkey & China — rows created but shipping rate left 0 (TBD): the engine returns
--         ratesUnavailable so no wrong number is ever shown until you set a rate.
-- Service fee / customs / insurance are left at editable defaults (0) for every
-- country except USA's 4% service fee — set the rest from the admin Pricing tab.
insert into public.pricing_config
  (country, currency, weight_unit,
   shipping_per_category, shipping_flat_rate, shipping_category_rates,
   service_fee_mode, service_fee_percent, service_fee_min, service_fee_per_piece,
   customs_per_category, customs_flat, customs_category_amounts,
   insurance_percent)
values
  ('USA', 'USD', 'lb',
   false, 6.00, '{}'::jsonb,
   'percentage', 4, 0, 0,
   false, 0, '{}'::jsonb,
   0),
  ('UAE', 'USD', 'kg',
   true, 0,
   '{"cosmetics":7.25,"supplements":35.00,"clothing":3.50,"electronics":10.00,"accessories":3.50,"uncategorized":3.50}'::jsonb,
   'percentage', 0, 0, 0,
   false, 0, '{}'::jsonb,
   0),
  ('Turkey', 'USD', 'kg',
   false, 0, '{}'::jsonb,
   'percentage', 0, 0, 0,
   false, 0, '{}'::jsonb,
   0),
  ('China', 'USD', 'kg',
   false, 0, '{}'::jsonb,
   'percentage', 0, 0, 0,
   false, 0, '{}'::jsonb,
   0)
on conflict (country) do nothing;
