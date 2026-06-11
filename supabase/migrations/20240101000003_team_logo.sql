-- Add logo_url column to teams
alter table public.teams
  add column if not exists logo_url text;

-- ── Supabase Storage ────────────────────────────────────────────────────────
-- Create a public bucket for team logos
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- RLS policies on storage objects for the team-logos bucket
-- Allow anyone to read (logos are public)
create policy "team-logos: public read"
  on storage.objects for select
  using (bucket_id = 'team-logos');

-- Allow uploads / updates / deletes from the admin panel
-- (anon key is sufficient because the bucket is admin-managed)
create policy "team-logos: allow insert"
  on storage.objects for insert
  with check (bucket_id = 'team-logos');

create policy "team-logos: allow update"
  on storage.objects for update
  using (bucket_id = 'team-logos');

create policy "team-logos: allow delete"
  on storage.objects for delete
  using (bucket_id = 'team-logos');
