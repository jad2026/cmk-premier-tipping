-- Manual league tables and league-wide results for competitions without a
-- data feed (Bridlington first). Existing feed-driven competitions are untouched.

-- null = existing behaviour (Xplorer/Opta feed); 'manual' = pasted by admins.
alter table public.competitions add column if not exists ladder_source text;

update public.competitions
  set ladder_source = 'manual'
  where id = '7a27f36c-aab6-4ba8-86e3-2bd9b182361e'; -- Bridlington

-- Other results in the same league round, shown under each round on /results.
create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  home_score integer not null,
  away_score integer not null,
  created_at timestamptz not null default now()
);

create index if not exists league_results_competition_gameweek_idx
  on public.league_results (competition_id, gameweek_id);

alter table public.league_results enable row level security;

create policy "League results are viewable by everyone" on public.league_results
  for select using (true);

create policy "Admins can manage league results" on public.league_results
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
