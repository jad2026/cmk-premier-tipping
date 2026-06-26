-- Fix Women's fixture → gameweek matching.
-- Old logic: date-proximity to nearest existing fixture (3-day window) — caused mismatches.
-- New logic: match_date must fall within the gameweek's deadline range
--   (previous gameweek's deadline, this gameweek's deadline].

create or replace function public.auto_manage_rounds()
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_created_gw int := 0;
  v_created_fx int := 0;
  v_created_fx_women int := 0;
  v_opened int := 0;
  v_closed int := 0;
  v_max_gw int;
  rec record;
begin

  select coalesce(max(number), 0) into v_max_gw from public.gameweeks;

  -- 1) Create missing gameweeks from MEN's REGULAR rounds
  for rec in
    select
      round_num,
      'Round ' || round_num as label,
      min_date - interval '1 hour' as deadline,
      min_date
    from (
      select
        nullif(regexp_replace(mr.round, '[^0-9]', '', 'g'), '')::int as round_num,
        min(mr.match_date::timestamptz) as min_date
      from public.match_results mr
      where mr.round is not null
        and mr.round like 'Round%'
        and nullif(regexp_replace(mr.round, '[^0-9]', '', 'g'), '') is not null
        and mr.match_date is not null
        and mr.home_team != ''
        and mr.comp_id = 'wbrsCngiwd6QbzWgA'
      group by round_num
    ) rounds
    where not exists (
      select 1 from public.gameweeks gw where gw.number = rounds.round_num
    )
    order by round_num
  loop
    insert into public.gameweeks (number, label, deadline, is_open)
    values (rec.round_num, rec.label, rec.deadline, false);
    v_created_gw := v_created_gw + 1;
    if rec.round_num > v_max_gw then
      v_max_gw := rec.round_num;
    end if;
  end loop;

  -- 2) Create gameweeks for FINALS (grouped by date, not round number)
  for rec in
    select
      match_week,
      min_date,
      min_date - interval '1 hour' as deadline,
      row_number() over (order by match_week) as finals_order
    from (
      select
        date_trunc('week', mr.match_date::timestamptz) as match_week,
        min(mr.match_date::timestamptz) as min_date
      from public.match_results mr
      where mr.round not like 'Round%'
        and mr.round != ''
        and mr.home_team != ''
        and mr.away_team != ''
        and mr.match_date is not null
        and mr.comp_id = 'wbrsCngiwd6QbzWgA'
      group by match_week
    ) finals_weeks
    where not exists (
      select 1 from public.gameweeks gw
      join public.fixtures f on f.gameweek_id = gw.id
      where f.match_date::date between (finals_weeks.min_date::date - 1) and (finals_weeks.min_date::date + 1)
    )
    order by match_week
  loop
    v_max_gw := v_max_gw + 1;
    insert into public.gameweeks (number, label, deadline, is_open)
    values (
      v_max_gw,
      case rec.finals_order
        when 1 then 'Semi Finals'
        when 2 then 'Grand Final'
        else 'Finals ' || rec.finals_order
      end,
      rec.deadline,
      false
    );
    v_created_gw := v_created_gw + 1;
  end loop;

  -- 3) Create missing MEN's fixtures for REGULAR rounds (by round number)
  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select
    gw.id,
    hm.team_id,
    am.team_id,
    mr.match_date::timestamptz,
    mr.venue
  from public.match_results mr
  join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
  join public.team_name_mapping am on am.xplorer_name = mr.away_team
  join public.gameweeks gw
    on gw.number = nullif(regexp_replace(mr.round, '[^0-9]', '', 'g'), '')::int
  where mr.comp_id = 'wbrsCngiwd6QbzWgA'
    and mr.round like 'Round%'
    and mr.home_team != ''
    and mr.away_team != ''
    and not exists (
      select 1 from public.fixtures f
      where f.gameweek_id = gw.id
        and f.home_team_id = hm.team_id
        and f.away_team_id = am.team_id
    );
  get diagnostics v_created_fx = row_count;

  -- 4) Create MEN's FINALS fixtures (matched by date to finals gameweeks)
  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select
    gw.id,
    hm.team_id,
    am.team_id,
    mr.match_date::timestamptz,
    mr.venue
  from public.match_results mr
  join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
  join public.team_name_mapping am on am.xplorer_name = mr.away_team
  join public.gameweeks gw on exists (
    select 1 from public.fixtures f2
    where f2.gameweek_id = gw.id
      and f2.match_date::date between (mr.match_date::date - 1) and (mr.match_date::date + 1)
  )
  where mr.comp_id = 'wbrsCngiwd6QbzWgA'
    and mr.round not like 'Round%'
    and mr.round != ''
    and mr.home_team != ''
    and mr.away_team != ''
    and not exists (
      select 1 from public.fixtures f
      where f.gameweek_id = gw.id
        and f.home_team_id = hm.team_id
        and f.away_team_id = am.team_id
    );
  get diagnostics v_created_fx_women = row_count;
  v_created_fx := v_created_fx + v_created_fx_women;
  v_created_fx_women := 0;

  -- 5) Create WOMEN's fixtures (matched by gameweek deadline range)
  --    A fixture belongs to the gameweek whose deadline range covers its match_date:
  --    range = (previous gameweek's deadline, this gameweek's deadline]
  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select distinct on (mr.external_id)
    gw_match.id as gameweek_id,
    hm.team_id,
    am.team_id,
    mr.match_date::timestamptz,
    mr.venue
  from public.match_results mr
  join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
  join public.team_name_mapping am on am.xplorer_name = mr.away_team
  join lateral (
    select gw2.id, gw2.deadline,
      coalesce(
        (select max(gw3.deadline) from public.gameweeks gw3 where gw3.deadline < gw2.deadline),
        '-infinity'::timestamptz
      ) as range_start
    from public.gameweeks gw2
    where mr.match_date::timestamptz > coalesce(
            (select max(gw3.deadline) from public.gameweeks gw3 where gw3.deadline < gw2.deadline),
            '-infinity'::timestamptz
          )
      and mr.match_date::timestamptz <= gw2.deadline
    order by gw2.deadline
    limit 1
  ) gw_match on true
  where mr.comp_id != 'wbrsCngiwd6QbzWgA'
    and mr.home_team != ''
    and mr.away_team != ''
    and mr.match_date is not null
    and not exists (
      select 1 from public.fixtures f
      where f.gameweek_id = gw_match.id
        and f.home_team_id = hm.team_id
        and f.away_team_id = am.team_id
    );
  get diagnostics v_created_fx_women = row_count;
  v_created_fx := v_created_fx + v_created_fx_women;

  -- 6) Auto-open: open rounds where first game is within 5 days
  update public.gameweeks
  set is_open = true
  where is_open = false
    and deadline > now()
    and deadline <= now() + interval '5 days'
    and not exists (
      select 1 from public.fixtures f
      where f.gameweek_id = gameweeks.id
        and f.result_team_id is not null
    );
  get diagnostics v_opened = row_count;

  -- 7) Auto-close: close rounds where deadline has passed
  update public.gameweeks
  set is_open = false
  where is_open = true
    and deadline < now();
  get diagnostics v_closed = row_count;

  return jsonb_build_object(
    'gameweeks_created', v_created_gw,
    'fixtures_created', v_created_fx,
    'rounds_opened', v_opened,
    'rounds_closed', v_closed
  );
end;
$function$;


-- Also fix bridge_xplorer_results to handle Women's fixtures.
-- The old version only matched by round number, which skips Women's results entirely.
-- New version: after the round-number pass, do a second pass matching by team IDs
-- across all gameweeks (for Women's fixtures that have no round number).

create or replace function public.bridge_xplorer_results()
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_updated int := 0;
  v_skipped int := 0;
  rec record;
begin
  for rec in
    select
      mr.external_id,
      mr.round,
      mr.home_team,
      mr.away_team,
      mr.home_score,
      mr.away_score,
      mr.comp_id,
      hm.team_id as home_team_id,
      am.team_id as away_team_id
    from public.match_results mr
    join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
    join public.team_name_mapping am on am.xplorer_name = mr.away_team
    where mr.result_status = 'final'
      and mr.home_score is not null
      and mr.away_score is not null
      and mr.home_score != ''
      and mr.away_score != ''
  loop
    declare
      v_fixture_id uuid;
      v_existing_result uuid;
      v_existing_draw boolean;
      v_home_score int;
      v_away_score int;
      v_winner_id uuid;
      v_is_draw boolean;
    begin
      -- Try to find the fixture: by round number for Men's, by team IDs for Women's
      if rec.comp_id = 'wbrsCngiwd6QbzWgA' and rec.round like 'Round%' then
        -- Men's regular: match by round number
        declare
          v_round_num int;
          v_gameweek_id uuid;
        begin
          v_round_num := nullif(regexp_replace(rec.round, '[^0-9]', '', 'g'), '')::int;
          if v_round_num is null then
            v_skipped := v_skipped + 1;
            continue;
          end if;

          select id into v_gameweek_id
          from public.gameweeks where number = v_round_num limit 1;

          if v_gameweek_id is null then
            v_skipped := v_skipped + 1;
            continue;
          end if;

          select id, result_team_id, is_draw
          into v_fixture_id, v_existing_result, v_existing_draw
          from public.fixtures
          where gameweek_id = v_gameweek_id
            and home_team_id = rec.home_team_id
            and away_team_id = rec.away_team_id
          limit 1;
        end;
      else
        -- Women's or finals: match by team IDs across all gameweeks
        select id, result_team_id, is_draw
        into v_fixture_id, v_existing_result, v_existing_draw
        from public.fixtures
        where home_team_id = rec.home_team_id
          and away_team_id = rec.away_team_id
          and result_team_id is null
          and is_draw = false
        order by match_date desc
        limit 1;
      end if;

      if v_fixture_id is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if v_existing_result is not null or v_existing_draw then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_home_score := rec.home_score::int;
      v_away_score := rec.away_score::int;

      if v_home_score > v_away_score then
        v_winner_id := rec.home_team_id;
        v_is_draw := false;
      elsif v_away_score > v_home_score then
        v_winner_id := rec.away_team_id;
        v_is_draw := false;
      else
        v_winner_id := null;
        v_is_draw := true;
      end if;

      update public.fixtures
      set result_team_id = v_winner_id,
          is_draw = v_is_draw
      where id = v_fixture_id;

      v_updated := v_updated + 1;

    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;
  end loop;

  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
end;
$function$;


-- One-time fix: reassign any existing Women's fixtures that are in the wrong gameweek.
-- Move them to the correct gameweek based on deadline-range matching.
-- Only touches fixtures from non-Men's teams (teams not in the Men's comp fixtures).

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
      correct_gw.id as correct_gw_id
    from public.fixtures f
    -- Only Women's fixtures: those whose home_team is NOT in any Men's match_result
    join public.teams ht on ht.id = f.home_team_id
    join public.team_name_mapping tnm on tnm.team_id = ht.id
    join lateral (
      select gw2.id
      from public.gameweeks gw2
      where f.match_date > coalesce(
              (select max(gw3.deadline) from public.gameweeks gw3 where gw3.deadline < gw2.deadline),
              '-infinity'::timestamptz
            )
        and f.match_date <= gw2.deadline
      order by gw2.deadline
      limit 1
    ) correct_gw on true
    where exists (
      select 1 from public.match_results mr
      where mr.home_team = tnm.xplorer_name
        and mr.comp_id != 'wbrsCngiwd6QbzWgA'
    )
    and f.gameweek_id != correct_gw.id
  loop
    update public.fixtures
    set gameweek_id = rec.correct_gw_id
    where id = rec.fixture_id;
    v_moved := v_moved + 1;
  end loop;

  raise notice 'Reassigned % Women''s fixtures to correct gameweeks', v_moved;
end;
$$;


-- Dedup: delete Women's fixture duplicates that ended up in the wrong gameweek.
-- Keeps the copy in the correct gameweek (by deadline-range), deletes the rest.
-- Only deletes fixtures with no picks attached.

do $$
declare
  v_deleted int := 0;
  rec record;
begin
  for rec in
    select f.id as fixture_id, gw.number as gw_number
    from public.fixtures f
    join public.gameweeks gw on gw.id = f.gameweek_id
    join public.teams ht on ht.id = f.home_team_id
    join public.team_name_mapping tnm on tnm.team_id = ht.id
    where exists (
      select 1 from public.match_results mr
      where mr.home_team = tnm.xplorer_name
        and mr.comp_id != 'wbrsCngiwd6QbzWgA'
    )
    -- This fixture is a duplicate: same teams+date exists in another gameweek
    and exists (
      select 1 from public.fixtures f2
      join public.gameweeks gw2 on gw2.id = f2.gameweek_id
      where f2.home_team_id = f.home_team_id
        and f2.away_team_id = f.away_team_id
        and f2.match_date = f.match_date
        and f2.id != f.id
    )
    -- This copy is in the WRONG gameweek (not matching deadline range)
    and not exists (
      select 1
      from public.gameweeks gw_check
      where gw_check.id = f.gameweek_id
        and f.match_date > coalesce(
              (select max(gw3.deadline) from public.gameweeks gw3 where gw3.deadline < gw_check.deadline),
              '-infinity'::timestamptz
            )
        and f.match_date <= gw_check.deadline
    )
    -- No picks attached
    and not exists (
      select 1 from public.picks p where p.fixture_id = f.id
    )
  loop
    delete from public.fixtures where id = rec.fixture_id;
    v_deleted := v_deleted + 1;
  end loop;

  raise notice 'Deleted % duplicate Women''s fixtures from wrong gameweeks', v_deleted;
end;
$$;
