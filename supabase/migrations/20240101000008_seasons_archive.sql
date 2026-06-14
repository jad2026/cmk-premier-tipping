-- Archive table for completed seasons
create table if not exists public.seasons (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  year          integer not null,
  archived_at   timestamptz not null default now(),
  winner_name   text,
  total_participants integer not null default 0,
  gameweeks_json jsonb not null default '[]',
  fixtures_json  jsonb not null default '[]',
  picks_json     jsonb not null default '[]'
);

alter table public.seasons enable row level security;

-- Only authenticated users can read (admin panel checks password client-side)
create policy "Seasons readable by authenticated users"
  on public.seasons for select
  using (auth.role() = 'authenticated');
