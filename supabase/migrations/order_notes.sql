-- Order notes / messaging thread migration
-- Run this in your Supabase SQL Editor

create table if not exists public.order_notes (
  id uuid default gen_random_uuid() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  is_admin boolean default false,
  is_read_by_customer boolean default false,
  is_read_by_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.order_notes enable row level security;

create policy "Customers can view notes on their orders"
  on public.order_notes for select
  using (
    exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
  );

create policy "Customers can add notes on their orders"
  on public.order_notes for insert
  with check (
    exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
    and auth.uid() = user_id
  );

create policy "Admins can manage all notes"
  on public.order_notes for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Also allow customers to mark their own notes as read (UPDATE)
create policy "Customers can update read status on their order notes"
  on public.order_notes for update
  using (
    exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
  );
