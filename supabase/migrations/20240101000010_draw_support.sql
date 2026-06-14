-- Allow picked_team_id to be null (for draw picks)
alter table public.picks
  alter column picked_team_id drop not null;

-- Add draw flag to picks
alter table public.picks
  add column if not exists picked_draw boolean not null default false;

-- Add draw flag to fixtures (distinct from result_team_id = null which means no result yet)
alter table public.fixtures
  add column if not exists is_draw boolean not null default false;

-- Update upsert_pick to support draw picks
create or replace function public.upsert_pick(
  p_fixture_id    uuid,
  p_picked_team_id uuid default null,
  p_picked_draw   boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.picks (user_id, fixture_id, picked_team_id, picked_draw)
  values (auth.uid(), p_fixture_id, p_picked_team_id, p_picked_draw)
  on conflict (user_id, fixture_id)
  do update set
    picked_team_id = excluded.picked_team_id,
    picked_draw    = excluded.picked_draw;
end;
$$;

-- Update score_fixture_picks to handle draws correctly
-- p_is_draw = true  → picks with picked_draw = true are correct, all others wrong
-- p_is_draw = false → picks where picked_team_id = p_result_team_id are correct
create or replace function public.score_fixture_picks(
  p_fixture_id     uuid,
  p_result_team_id uuid default null,
  p_is_draw        boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.picks
  set is_correct = case
    when p_is_draw then (picked_draw = true)
    else (picked_team_id = p_result_team_id)
  end
  where fixture_id = p_fixture_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
