-- ── Leagues ────────────────────────────────────────────────────────────────
create table public.leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.leagues enable row level security;

create policy "Anyone can read leagues" on public.leagues
  for select using (true);
create policy "Users can insert their own leagues" on public.leagues
  for insert with check (auth.uid() = created_by);
create policy "Creators can update their league" on public.leagues
  for update using (auth.uid() = created_by);

-- ── League members ──────────────────────────────────────────────────────────
create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.league_members enable row level security;

create policy "Anyone can read league_members" on public.league_members
  for select using (true);
create policy "Users can insert themselves" on public.league_members
  for insert with check (auth.uid() = user_id);
create policy "Users can remove themselves" on public.league_members
  for delete using (auth.uid() = user_id);
