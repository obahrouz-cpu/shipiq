-- =============================================
-- ShipIQ Tier System Update — Silver → Titanium
-- Run this in the Supabase SQL Editor
-- =============================================

-- Step 1: Reseed tier_settings with the new 5 tiers
delete from public.tier_settings;
insert into public.tier_settings (tier, name_en, name_ar, min_spend, color, icon, benefits, is_active) values
('silver',   'Silver',   'فضي',     0,    '#C0C0C0', '⭐', '', true),
('gold',     'Gold',     'ذهبي',    500,  '#FFD700', '🥇', '', true),
('diamond',  'Diamond',  'ماسي',    1000, '#B9F2FF', '💎', '', true),
('platinum', 'Platinum', 'بلاتيني', 2000, '#E5E4E2', '👑', '', true),
('titanium', 'Titanium', 'تيتانيوم',3000, '#878681', '🔱', '', true);

-- Step 2: Make Silver the default starting tier and migrate existing bronze users
alter table public.profiles alter column tier set default 'silver';
update public.profiles set tier = 'silver' where tier = 'bronze';

-- Done. Verify with:
-- SELECT tier, name_en, min_spend FROM public.tier_settings ORDER BY min_spend;
-- SELECT id, email, tier, total_spent FROM public.profiles ORDER BY total_spent DESC;
