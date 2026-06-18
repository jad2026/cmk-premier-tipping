-- Called by the admin "Start New Season" flow with service role.
-- Deletes all active season data in FK-safe order and resets config.
create or replace function clear_season_data(new_season_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from picks;
  delete from fixtures;
  delete from gameweeks;
  update season_config
    set season_complete = false,
        season_name     = new_season_name
    where id = 1;
end;
$$;

-- Only the service role / postgres superuser may call this
revoke execute on function clear_season_data(text) from public, anon, authenticated;
