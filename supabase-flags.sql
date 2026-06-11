-- ube-app card_flags table
-- Run this in the Supabase SQL Editor

create table if not exists public.card_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  card_ids jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.card_flags enable row level security;

create policy "Users manage own flags" on public.card_flags
  for all using (auth.uid() = user_id);
