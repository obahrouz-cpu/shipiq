-- Last mile delivery system migration
-- Run this in your Supabase SQL Editor

-- delivery_requests table
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id text PRIMARY KEY DEFAULT ('DEL-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_ids text[] NOT NULL,
  delivery_preference text NOT NULL,
  delivery_city text,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_notes text,
  delivery_fee numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

-- Customers: view own requests
CREATE POLICY "customers_view_own_delivery_requests"
  ON public.delivery_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Customers: create own requests
CREATE POLICY "customers_insert_delivery_requests"
  ON public.delivery_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins: view all requests
CREATE POLICY "admins_view_all_delivery_requests"
  ON public.delivery_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins: update all requests (status changes)
CREATE POLICY "admins_update_delivery_requests"
  ON public.delivery_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
