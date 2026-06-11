-- User profiles — one row per auth user, holds public display name
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  updated_at   timestamptz default now()
);

alter table public.profiles enable row level security;

-- Everyone can read profiles (needed for leaderboard display names)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can insert their own profile (needed for the trigger path)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── Trigger: auto-create a blank profile on signup ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer           -- runs as superuser so it can insert regardless of RLS
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Backfill: create profiles for any users who already exist ─────────────
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
