-- Add avatar_url to profiles
alter table public.profiles
  add column if not exists avatar_url text;

-- Avatars storage bucket (public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RLS: anyone can read avatars
create policy "Public avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

-- RLS: authenticated users can upload/update their own avatar (path = user_id/*)
create policy "Users can upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Users can update own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Users can delete own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
