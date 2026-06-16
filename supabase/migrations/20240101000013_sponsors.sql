create table public.sponsors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  logo_url         text,
  website_url      text,
  display_location text not null default 'all' check (display_location in ('home','leaderboard','email','all')),
  is_active        boolean not null default true,
  order_position   integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.sponsors enable row level security;

-- Everyone can read active sponsors (needed for SSR pages)
create policy "Public can read sponsors" on public.sponsors
  for select using (true);

-- No RLS insert/update/delete — admin uses service role client

-- Sponsor logos storage bucket
insert into storage.buckets (id, name, public)
values ('sponsors', 'sponsors', true)
on conflict (id) do nothing;

create policy "Public sponsor logo read" on storage.objects
  for select using (bucket_id = 'sponsors');

create policy "Service role sponsor logo write" on storage.objects
  for insert with check (bucket_id = 'sponsors');

create policy "Service role sponsor logo update" on storage.objects
  for update using (bucket_id = 'sponsors');

create policy "Service role sponsor logo delete" on storage.objects
  for delete using (bucket_id = 'sponsors');
