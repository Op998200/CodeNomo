-- Cashivo Database Schema
-- Run this in Supabase SQL editor

-- 1) profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'user', -- 'user' | 'admin'
  status text not null default 'active', -- 'active' | 'suspended'
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- 2) categories (global when owner_id is null)
create table if not exists public.categories (
  id bigserial primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  created_at timestamp with time zone default now()
);
create index if not exists categories_owner_idx on public.categories(owner_id);

-- 3) transactions
create table if not exists public.transactions (
  id bigserial primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category_id bigint references public.categories(id) on delete set null,
  date date not null default (current_date),
  payment_method text,
  image_url text,
  notes text,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists transactions_owner_idx on public.transactions(owner_id);
create index if not exists transactions_date_idx on public.transactions(date);

-- 4) payments
create table if not exists public.payments (
  id bigserial primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  status text not null default 'created', -- created | authorized | captured | failed
  razorpay_order_id text unique,
  razorpay_payment_id text,
  created_at timestamp with time zone default now()
);
create index if not exists payments_owner_idx on public.payments(owner_id);

-- 5) templates (user-defined transaction templates)
create table if not exists public.templates (
  id bigserial primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  default_amount numeric(12,2),
  category_id bigint references public.categories(id) on delete set null,
  fields jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 6) audit_logs
create table if not exists public.audit_logs (
  id bigserial primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  action text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.payments enable row level security;
alter table public.templates enable row level security;
alter table public.audit_logs enable row level security;

-- RLS Policies
-- profiles: users can view and update their own profile; admins can access all
create policy if not exists profiles_select_self_or_admin on public.profiles
  for select using (
    id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy if not exists profiles_update_self on public.profiles
  for update using (id = auth.uid());
create policy if not exists profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy if not exists profiles_delete_admin on public.profiles
  for delete using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- categories: owners can manage their own; global (owner_id is null) readable by all
create policy if not exists categories_select_all on public.categories
  for select using (true);
create policy if not exists categories_modify_owner on public.categories
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- transactions: owner can manage; admins can access all
create policy if not exists transactions_select_owner_or_admin on public.transactions
  for select using (
    owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy if not exists transactions_modify_owner on public.transactions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- payments: owner can view; inserts occur via edge functions (service role bypass)
create policy if not exists payments_select_owner_or_admin on public.payments
  for select using (
    owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy if not exists payments_modify_owner on public.payments
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- templates: owner can manage
create policy if not exists templates_owner_all on public.templates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- audit_logs: readable by admins only; inserts by service role
create policy if not exists audit_logs_admin_select on public.audit_logs
  for select using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed default categories
insert into public.categories (owner_id, name, type) values
  (null, 'Salary', 'income'),
  (null, 'Business', 'income'),
  (null, 'Interest', 'income'),
  (null, 'Wallet Top-up', 'income'),
  (null, 'Rent', 'expense'),
  (null, 'Groceries', 'expense'),
  (null, 'Food', 'expense'),
  (null, 'Transport', 'expense'),
  (null, 'Utilities', 'expense'),
  (null, 'Shopping', 'expense')
on conflict do nothing;

-- Helper trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create or replace trigger transactions_set_updated_at
before update on public.transactions
for each row execute procedure public.set_updated_at();