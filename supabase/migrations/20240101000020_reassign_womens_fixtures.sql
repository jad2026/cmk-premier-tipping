-- Reassign ALL Women's fixtures to the correct gameweek based on match_date.
-- Women's fixtures are identified by team name containing 'Women'.
-- The correct gameweek is the one whose deadline range covers the match_date:
--   range = (previous gameweek's deadline, this gameweek's deadline]
-- Also deletes duplicate Women's fixtures (same teams + same match_date in multiple gameweeks).

-- Step 1: Delete duplicates first (keep the one with the most recent gameweek number,
-- but only if it has no picks).
do $$
declare
  v_deleted int := 0;
  rec record;
begin
  for rec in
    select f.id as fixture_id
    from public.fixtures f
    join public.teams ht on ht.id = f.home_team_id
    where ht.name like '%Women%'
    -- This fixture has a duplicate (same teams, same date, different gameweek)
    and exists (
      select 1 from public.fixtures f2
      where f2.home_team_id = f.home_team_id
        and f2.away_team_id = f.away_team_id
        and f2.match_date = f.match_date
        and f2.id != f.id
    )
    -- Keep the one with the higher gameweek number (delete the lower/wrong one)
    and exists (
      select 1 from public.fixtures f2
      join public.gameweeks gw2 on gw2.id = f2.gameweek_id
      join public.gameweeks gw on gw.id = f.gameweek_id
      where f2.home_team_id = f.home_team_id
        and f2.away_team_id = f.away_team_id
        and f2.match_date = f.match_date
        and f2.id != f.id
        and gw2.number > gw.number
    )
    -- Only delete if no picks attached
    and not exists (
      select 1 from public.picks p where p.fixture_id = f.id
    )
  loop
    delete from public.fixtures where id = rec.fixture_id;
    v_deleted := v_deleted + 1;
  end loop;

  raise notice 'Deleted % duplicate Women''s fixtures', v_deleted;
end;
$$;

-- Step 2: Reassign remaining Women's fixtures to correct gameweek by match_date
do $$
declare
  v_moved int := 0;
  rec record;
begin
  for rec in
    select
      f.id as fixture_id,
      f.gameweek_id as current_gw_id,
      f.match_date,
      ht.name as home_name,
      correct_gw.id as correct_gw_id,
      correct_gw.number as correct_gw_number,
      cur_gw.number as current_gw_number
    from public.fixtures f
    join public.teams ht on ht.id = f.home_team_id
    join public.gameweeks cur_gw on cur_gw.id = f.gameweek_id
    join lateral (
      select gw2.id, gw2.number
      from public.gameweeks gw2
      where f.match_date > coalesce(
              (select max(gw3.deadline) from public.gameweeks gw3 where gw3.deadline < gw2.deadline),
              '-infinity'::timestamptz
            )
        and f.match_date <= gw2.deadline
      order by gw2.deadline
      limit 1
    ) correct_gw on true
    where ht.name like '%Women%'
      and f.gameweek_id != correct_gw.id
  loop
    update public.fixtures
    set gameweek_id = rec.correct_gw_id
    where id = rec.fixture_id;

    raise notice 'Moved % (%) from Round % → Round %',
      rec.home_name, rec.match_date, rec.current_gw_number, rec.correct_gw_number;
    v_moved := v_moved + 1;
  end loop;

  raise notice 'Reassigned % Women''s fixtures total', v_moved;
end;
$$;
