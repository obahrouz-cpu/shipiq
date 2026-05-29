-- =============================================
-- ShipIQ Tier / total_spent Migration
-- Run this in the Supabase SQL Editor
-- =============================================

-- Step 1: Add columns if they don't already exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'silver',
  ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0;

-- Step 2: Reset all profiles (clears any bad test data)
UPDATE public.profiles SET total_spent = 0, tier = 'silver';

-- Step 3: Function that recalculates total_spent and tier for one user
CREATE OR REPLACE FUNCTION recalculate_total_spent(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_spent numeric;
  v_tier        text;
BEGIN
  -- Sum shipping_price (stored in IQD) ÷ 1450 → USD
  -- Only count orders that are confirmed or further along the pipeline
  SELECT COALESCE(
    SUM(shipping_price::numeric / 1450.0),
    0
  )
  INTO v_total_spent
  FROM public.orders
  WHERE user_id    = p_user_id
    AND status     IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered')
    AND shipping_price IS NOT NULL
    AND shipping_price > 0;

  -- Determine tier from tier_settings table (falls back to silver if table is empty)
  BEGIN
    SELECT tier
    INTO v_tier
    FROM public.tier_settings
    WHERE is_active = true
      AND min_spend <= v_total_spent
    ORDER BY min_spend DESC
    LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    v_tier := NULL;
  END;

  v_tier := COALESCE(v_tier, 'silver');

  UPDATE public.profiles
  SET total_spent = v_total_spent,
      tier        = v_tier
  WHERE id = p_user_id;
END;
$$;

-- Step 4: Trigger function — fires on INSERT or UPDATE of orders
CREATE OR REPLACE FUNCTION trigger_recalculate_total_spent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered') THEN
      PERFORM recalculate_total_spent(NEW.user_id);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Re-run whenever the status or shipping_price changes in a way that affects spend
    IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.shipping_price IS DISTINCT FROM OLD.shipping_price
    THEN
      -- Cover both the new user_id and the old one (in case user_id somehow changed)
      IF NEW.status IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered')
      OR OLD.status IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered')
      THEN
        PERFORM recalculate_total_spent(NEW.user_id);
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
          PERFORM recalculate_total_spent(OLD.user_id);
        END IF;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered') THEN
      PERFORM recalculate_total_spent(OLD.user_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Step 5: Attach trigger to orders table
DROP TRIGGER IF EXISTS orders_total_spent_trigger ON public.orders;

CREATE TRIGGER orders_total_spent_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_total_spent();

-- Step 6: Backfill — recalculate total_spent for every user
--   who has at least one qualifying order
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM public.orders
    WHERE status IN ('confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered')
      AND shipping_price IS NOT NULL
      AND shipping_price > 0
  LOOP
    PERFORM recalculate_total_spent(r.user_id);
  END LOOP;
END $$;

-- Done. Verify with:
-- SELECT id, email, tier, total_spent FROM public.profiles ORDER BY total_spent DESC;
