-- LostLink — Supabase schema (auth + database + storage)
-- Run this ONCE in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Project: lostlink-ncet (https://akuuqicqljrolvmfwwyq.supabase.co)
-- Auth is Supabase Auth (email/password + Google).
-- The "item-photos" storage bucket + its anon view/upload policies already exist;
-- the DO blocks at the bottom only add them if they are missing (idempotent).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  usn text not null,
  department text not null,
  branch_code text not null,
  year text not null,
  name text not null default '',
  mobile text not null default ''
);

create table if not exists public.found_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null,
  place_found text not null,
  date_found date,
  collect_dept text not null,
  status text not null default 'Pending',
  photo_url text not null default '',
  finder_usn text not null,
  finder_name text not null default '',
  uploader_name text not null default '',
  uploader_uid uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.found_items_private (
  item_id uuid primary key references public.found_items (id) on delete cascade,
  mobile text not null default '',
  description text not null default ''
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null,
  owner_usn text not null,
  owner_uid uuid not null,
  found_item_id uuid,
  match_status text not null default 'Waiting for Match',
  item_status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists public.complaints_private (
  complaint_id uuid primary key references public.complaints (id) on delete cascade,
  mobile text not null default '',
  description text not null default ''
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  found_item_id uuid not null references public.found_items (id) on delete cascade,
  owner_uid uuid not null,
  owner_usn text not null,
  finder_uid uuid not null,
  finder_usn text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  found_item_id uuid not null references public.found_items (id) on delete cascade,
  author_uid uuid not null,
  usn text not null,
  rating int not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: authenticated users only — NEVER anon.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.found_items enable row level security;
alter table public.found_items_private enable row level security;
alter table public.complaints enable row level security;
alter table public.complaints_private enable row level security;
alter table public.matches enable row level security;
alter table public.feedback enable row level security;

-- users: only your own row
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile" on public.users
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- found_items: any authenticated user can view; only the uploader can insert/update
drop policy if exists "Authenticated can view found items" on public.found_items;
create policy "Authenticated can view found items" on public.found_items
  for select to authenticated using (true);
drop policy if exists "Uploaders can insert found items" on public.found_items;
create policy "Uploaders can insert found items" on public.found_items
  for insert to authenticated with check (uploader_uid = auth.uid());
drop policy if exists "Uploaders can update found items" on public.found_items;
create policy "Uploaders can update found items" on public.found_items
  for update to authenticated using (uploader_uid = auth.uid()) with check (uploader_uid = auth.uid());

-- found_items_private: the uploader, or the other party after a Confirmed match
drop policy if exists "Owner or confirmed party can view found item details" on public.found_items_private;
create policy "Owner or confirmed party can view found item details" on public.found_items_private
  for select to authenticated using (
    item_id in (select id from public.found_items where uploader_uid = auth.uid())
    or exists (select 1 from public.matches
      where matches.found_item_id = found_items_private.item_id
        and matches.status = 'Confirmed'
        and (matches.owner_uid = auth.uid() or matches.finder_uid = auth.uid()))
  );
drop policy if exists "Uploaders can insert found item details" on public.found_items_private;
create policy "Uploaders can insert found item details" on public.found_items_private
  for insert to authenticated with check (
    item_id in (select id from public.found_items where uploader_uid = auth.uid())
  );

-- complaints: any authenticated user can view; only the owner can insert/update
drop policy if exists "Authenticated can view complaints" on public.complaints;
create policy "Authenticated can view complaints" on public.complaints
  for select to authenticated using (true);
drop policy if exists "Owners can insert complaints" on public.complaints;
create policy "Owners can insert complaints" on public.complaints
  for insert to authenticated with check (owner_uid = auth.uid());
drop policy if exists "Owners can update complaints" on public.complaints;
create policy "Owners can update complaints" on public.complaints
  for update to authenticated using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());

-- complaints_private: the owner, or the other party after a Confirmed match
drop policy if exists "Owner or confirmed party can view complaint details" on public.complaints_private;
create policy "Owner or confirmed party can view complaint details" on public.complaints_private
  for select to authenticated using (
    complaint_id in (select id from public.complaints where owner_uid = auth.uid())
    or exists (select 1 from public.matches
      where matches.complaint_id = complaints_private.complaint_id
        and matches.status = 'Confirmed'
        and (matches.owner_uid = auth.uid() or matches.finder_uid = auth.uid()))
  );
drop policy if exists "Owners can insert complaint details" on public.complaints_private;
create policy "Owners can insert complaint details" on public.complaints_private
  for insert to authenticated with check (
    complaint_id in (select id from public.complaints where owner_uid = auth.uid())
  );

-- matches: any authenticated user can view; owner or finder can insert/update
drop policy if exists "Authenticated can view matches" on public.matches;
create policy "Authenticated can view matches" on public.matches
  for select to authenticated using (true);
drop policy if exists "Owner or finder can insert matches" on public.matches;
create policy "Owner or finder can insert matches" on public.matches
  for insert to authenticated with check (owner_uid = auth.uid() or finder_uid = auth.uid());
drop policy if exists "Owner or finder can update matches" on public.matches;
create policy "Owner or finder can update matches" on public.matches
  for update to authenticated using (owner_uid = auth.uid() or finder_uid = auth.uid());

-- feedback: any authenticated user can view; only the author can insert
drop policy if exists "Authenticated can view feedback" on public.feedback;
create policy "Authenticated can view feedback" on public.feedback
  for select to authenticated using (true);
drop policy if exists "Authors can insert feedback" on public.feedback;
create policy "Authors can insert feedback" on public.feedback
  for insert to authenticated with check (author_uid = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage policies for bucket "item-photos" (already created — idempotent).
-- The app uploads with the anon key, and also with a signed-in session,
-- so both anon and authenticated roles need view + upload.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anyone can view item photos') then
    create policy "Anyone can view item photos" on storage.objects
      for select to anon using (bucket_id = 'item-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anyone can upload item photos') then
    create policy "Anyone can upload item photos" on storage.objects
      for insert to anon with check (bucket_id = 'item-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated can view item photos') then
    create policy "Authenticated can view item photos" on storage.objects
      for select to authenticated using (bucket_id = 'item-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated can upload item photos') then
    create policy "Authenticated can upload item photos" on storage.objects
      for insert to authenticated with check (bucket_id = 'item-photos');
  end if;
end $$;
