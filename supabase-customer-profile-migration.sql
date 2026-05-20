-- ── Customer Profile Admin Migration ─────────────────────────────────────────
-- Run this in your Supabase SQL editor

-- Add new columns to profiles
alter table public.profiles
  add column if not exists is_suspended boolean default false,
  add column if not exists suspension_reason text,
  add column if not exists last_seen_at timestamptz;

-- Admin notes table (internal, customer never sees)
create table if not exists public.customer_admin_notes (
  id             uuid default gen_random_uuid() primary key,
  customer_id    uuid references public.profiles(id) on delete cascade not null,
  admin_id       uuid references public.profiles(id) on delete set null,
  note           text not null,
  created_at     timestamptz default now()
);

alter table public.customer_admin_notes enable row level security;

-- Only admins can read/write admin notes
create policy "Admins can manage customer notes"
  on public.customer_admin_notes for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Index for fast lookups by customer
create index if not exists idx_customer_admin_notes_customer_id
  on public.customer_admin_notes(customer_id);
