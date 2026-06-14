alter table public.season_config
  add column if not exists season_name text not null default '2026 Season';
