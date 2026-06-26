-- ── 1. Update auto_fill_missing_picks to scope by competition_participants ──
-- Now filters to only competition participants who joined BEFORE the gameweek
-- deadline, and only fills picks for gameweeks whose deadline has already passed.
create or replace function public.auto_fill_missing_picks(p_gameweek_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_deadline timestamptz;
  v_comp_id  uuid;
begin
  -- Look up this gameweek's deadline and competition
  select deadline, competition_id
    into v_deadline, v_comp_id
    from public.gameweeks
   where id = p_gameweek_id;

  if v_deadline is null then
    raise exception 'Gameweek % not found', p_gameweek_id;
  end if;

  -- Only fill picks if the deadline has already passed
  if v_deadline > now() then
    return 0;
  end if;

  insert into public.picks (user_id, fixture_id, picked_team_id, auto_picked)
  select
    cp.user_id                                                 as user_id,
    fix.id                                                     as fixture_id,
    case when random() < 0.5 then fix.home_team_id
                              else fix.away_team_id end        as picked_team_id,
    true                                                       as auto_picked
  from
    public.competition_participants cp
    cross join public.fixtures fix
  where
    fix.gameweek_id = p_gameweek_id
    and cp.competition_id = v_comp_id
    -- Only auto-pick for users who joined BEFORE the deadline
    and cp.joined_at <= v_deadline
    and not exists (
      select 1
      from   public.picks p
      where  p.user_id    = cp.user_id
      and    p.fixture_id = fix.id
    )
  on conflict (user_id, fixture_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ── 2. Wrapper function for cron: auto-fill all eligible gameweeks ──────────
-- Finds gameweeks where:
--   - deadline has passed
--   - at least one fixture has NO result yet (round still in progress)
--   - there are still missing picks
-- Then calls auto_fill_missing_picks for each.
create or replace function public.auto_fill_all_overdue_picks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gw_id   uuid;
  v_total   integer := 0;
  v_batch   integer;
begin
  for v_gw_id in
    select distinct g.id
      from public.gameweeks g
      join public.fixtures f on f.gameweek_id = g.id
     where g.deadline < now()
       -- At least one fixture in this gameweek has no result yet
       and exists (
         select 1 from public.fixtures f2
          where f2.gameweek_id = g.id
            and f2.result_team_id is null
            and f2.is_draw is not true
       )
  loop
    v_batch := public.auto_fill_missing_picks(v_gw_id);
    v_total := v_total + v_batch;
  end loop;

  return v_total;
end;
$$;

-- ── 3. Cron job: run every 30 minutes ──────────────────────────────────────
-- Requires pg_cron extension to be enabled in the Supabase project.
-- If pg_cron is not available, this will fail silently; the admin button
-- provides a manual fallback.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'auto-fill-random-picks',
      '*/30 * * * *',
      'select public.auto_fill_all_overdue_picks();'
    );
  end if;
end;
$$;
