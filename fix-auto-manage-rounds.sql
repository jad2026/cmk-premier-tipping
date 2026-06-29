create or replace function auto_manage_rounds()
returns jsonb as $$
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

  for rec in
    select
      round_num,
      'Round ' || round_num as label,
      ((min_date at time zone 'Pacific/Auckland')::date + interval '11 hours') at time zone 'Pacific/Auckland' as deadline,
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

  for rec in
    select
      match_week,
      min_date,
      ((min_date at time zone 'Pacific/Auckland')::date + interval '11 hours') at time zone 'Pacific/Auckland' as deadline,
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
      where gw.deadline::date between (finals_weeks.min_date::date - 1) and (finals_weeks.min_date::date + 1)
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

  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select
    gw.id, hm.team_id, am.team_id, mr.match_date::timestamptz, mr.venue
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

  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select
    gw.id, hm.team_id, am.team_id, mr.match_date::timestamptz, mr.venue
  from public.match_results mr
  join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
  join public.team_name_mapping am on am.xplorer_name = mr.away_team
  cross join lateral (
    select gw2.id
    from public.gameweeks gw2
    where gw2.deadline::date between (mr.match_date::date - 1) and (mr.match_date::date + 1)
      and gw2.label not like 'Round%'
    order by abs(extract(epoch from (gw2.deadline - mr.match_date::timestamptz)))
    limit 1
  ) gw
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

  insert into public.fixtures (gameweek_id, home_team_id, away_team_id, match_date, venue)
  select distinct on (mr.external_id)
    gw.id as gameweek_id, hm.team_id, am.team_id, mr.match_date::timestamptz, mr.venue
  from public.match_results mr
  join public.team_name_mapping hm on hm.xplorer_name = mr.home_team
  join public.team_name_mapping am on am.xplorer_name = mr.away_team
  cross join lateral (
    select gw2.id, min(abs(extract(epoch from (f2.match_date - mr.match_date::timestamptz)))) as dist
    from public.gameweeks gw2
    join public.fixtures f2 on f2.gameweek_id = gw2.id
    where abs(extract(epoch from (f2.match_date - mr.match_date::timestamptz))) < 259200
    group by gw2.id
    order by dist
    limit 1
  ) gw
  where mr.comp_id != 'wbrsCngiwd6QbzWgA'
    and mr.home_team != ''
    and mr.away_team != ''
    and mr.match_date is not null
    and not exists (
      select 1 from public.fixtures f
      where f.gameweek_id = gw.id
        and f.home_team_id = hm.team_id
        and f.away_team_id = am.team_id
    );
  get diagnostics v_created_fx_women = row_count;
  v_created_fx := v_created_fx + v_created_fx_women;

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
$$ language plpgsql;
