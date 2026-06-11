-- ── 1. Add auto_picked column ─────────────────────────────────────────────
alter table public.picks
  add column if not exists auto_picked boolean not null default false;

comment on column public.picks.auto_picked is
  'TRUE when the pick was auto-assigned after the deadline because the user did not submit one.';

-- ── 2. auto_fill_missing_picks ────────────────────────────────────────────
-- Inserts a random pick (home or away, 50/50) for every (user, fixture) pair
-- in the given gameweek that does not already have a pick.
-- Uses SECURITY DEFINER so it can insert on behalf of any user, bypassing RLS.
-- Reads from public.profiles to enumerate all registered users.
create or replace function public.auto_fill_missing_picks(p_gameweek_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.picks (user_id, fixture_id, picked_team_id, auto_picked)
  select
    prof.id                                                    as user_id,
    fix.id                                                     as fixture_id,
    case when random() < 0.5 then fix.home_team_id
                              else fix.away_team_id end        as picked_team_id,
    true                                                       as auto_picked
  from
    public.profiles  prof
    cross join public.fixtures fix
  where
    fix.gameweek_id = p_gameweek_id
    and not exists (
      select 1
      from   public.picks p
      where  p.user_id    = prof.id
      and    p.fixture_id = fix.id
    )
  on conflict (user_id, fixture_id) do nothing;   -- idempotent if called twice

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ── 3. score_fixture_picks ────────────────────────────────────────────────
-- Updates is_correct on ALL picks for a fixture in one statement.
-- p_result_team_id = NULL means the result was a draw → all picks wrong.
-- Uses SECURITY DEFINER so it can update any user's pick row, bypassing RLS.
create or replace function public.score_fixture_picks(
  p_fixture_id     uuid,
  p_result_team_id uuid   -- pass NULL for draw
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
    when p_result_team_id is null then false                      -- draw
    else (picked_team_id = p_result_team_id)                      -- win/loss
  end
  where fixture_id = p_fixture_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
