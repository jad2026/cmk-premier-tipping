-- Teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  colour text not null default '#000000'
);

alter table public.teams enable row level security;
create policy "Teams are viewable by everyone" on public.teams
  for select using (true);

-- Gameweeks
create table public.gameweeks (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  label text not null,
  deadline timestamptz not null,
  is_open boolean not null default false
);

alter table public.gameweeks enable row level security;
create policy "Gameweeks are viewable by everyone" on public.gameweeks
  for select using (true);

-- Fixtures
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  match_date timestamptz not null,
  venue text,
  result_team_id uuid references public.teams(id)
);

alter table public.fixtures enable row level security;
create policy "Fixtures are viewable by everyone" on public.fixtures
  for select using (true);

-- Picks
create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  picked_team_id uuid not null references public.teams(id),
  is_correct boolean,
  unique(user_id, fixture_id)
);

alter table public.picks enable row level security;
create policy "Users can view all picks" on public.picks
  for select using (true);
create policy "Users can insert their own picks" on public.picks
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own picks" on public.picks
  for update using (auth.uid() = user_id);
