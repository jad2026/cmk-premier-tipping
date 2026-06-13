-- Add first_name and last_name columns to profiles
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;
