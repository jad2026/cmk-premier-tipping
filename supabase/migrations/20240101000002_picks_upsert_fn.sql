-- Convenience function for upsert picks from the app
create or replace function public.upsert_pick(
  p_fixture_id uuid,
  p_picked_team_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.picks (user_id, fixture_id, picked_team_id)
  values (auth.uid(), p_fixture_id, p_picked_team_id)
  on conflict (user_id, fixture_id)
  do update set picked_team_id = excluded.picked_team_id;
end;
$$;
