-- Single-row config table for season-wide settings.
-- Enforced to one row via a check constraint on id = 1.
create table if not exists season_config (
  id integer primary key default 1 check (id = 1),
  season_complete boolean not null default false
);

-- Seed the single row if it doesn't exist
insert into season_config (id, season_complete)
values (1, false)
on conflict (id) do nothing;
