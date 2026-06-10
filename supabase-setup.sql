-- ube-app Supabase setup SQL
-- Run this in the Supabase SQL Editor

-- 1. blank overrides (伏字カスタマイズ)
create table if not exists public.blank_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id integer not null,
  override jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, card_id)
);
alter table public.blank_overrides enable row level security;
create policy "Users manage own overrides" on public.blank_overrides
  for all using (auth.uid() = user_id);

-- 2. stats (正答率)
create table if not exists public.stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id integer not null,
  correct integer not null default 0,
  total integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, card_id)
);
alter table public.stats enable row level security;
create policy "Users manage own stats" on public.stats
  for all using (auth.uid() = user_id);

-- 3. card memos (カードメモ)
create table if not exists public.card_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id integer not null,
  memo text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, card_id)
);
alter table public.card_memos enable row level security;
create policy "Users manage own card memos" on public.card_memos
  for all using (auth.uid() = user_id);

-- 4. expression memos (表現メモ)
create table if not exists public.expression_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  memo_id bigint not null,
  word text not null default '',
  content text not null default '',
  examples text not null default '',
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, memo_id)
);
alter table public.expression_memos enable row level security;
create policy "Users manage own expression memos" on public.expression_memos
  for all using (auth.uid() = user_id);
