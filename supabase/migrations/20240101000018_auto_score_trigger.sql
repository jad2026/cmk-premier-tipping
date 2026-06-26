-- Auto-recalculate is_correct on all picks when a fixture's result changes.
-- Fires on UPDATE of result_team_id or is_draw on the fixtures table.
create or replace function public.auto_score_on_result_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when result_team_id or is_draw actually changed
  if (old.result_team_id is distinct from new.result_team_id)
     or (old.is_draw is distinct from new.is_draw) then

    if new.is_draw then
      -- Draw: picks with picked_draw = true are correct, all others wrong
      update public.picks
         set is_correct = (picked_draw = true)
       where fixture_id = new.id;
    elsif new.result_team_id is not null then
      -- Win: picks matching the winning team are correct
      update public.picks
         set is_correct = (picked_team_id = new.result_team_id)
       where fixture_id = new.id;
    else
      -- Result cleared: reset is_correct to null
      update public.picks
         set is_correct = null
       where fixture_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_fixture_result_change
  after update on public.fixtures
  for each row
  execute function public.auto_score_on_result_change();
