-- Add supported_team_id column to profiles
alter table public.profiles
  add column if not exists supported_team_id uuid references public.teams(id) on delete set null;

comment on column public.profiles.supported_team_id is
  'The team this user supports. NULL if unset or "no team". Only used by competitions with show_supported_team enabled.';
