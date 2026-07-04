-- outline_user_data table
-- Run this in the Supabase SQL Editor

create table if not exists public.outline_user_data (
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.outline_user_data enable row level security;

create policy "Users manage own outline data" on public.outline_user_data
  for all using (auth.uid() = user_id);
