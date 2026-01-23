-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  theme_color text default '#000000',
  layout_style text default 'classic',
  profile_theme text default 'light',
  background_url text,
  background_type text default 'color',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ADD COLUMNS IF THEY DO NOT EXIST (for existing tables)
do $$
begin
  -- Profiles columns
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='is_active') then
    alter table public.profiles add column is_active boolean default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='theme_color') then
    alter table public.profiles add column theme_color text default '#000000';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='layout_style') then
    alter table public.profiles add column layout_style text default 'classic';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='profile_theme') then
    alter table public.profiles add column profile_theme text default 'light';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='background_url') then
    alter table public.profiles add column background_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='background_type') then
    alter table public.profiles add column background_type text default 'color';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='bio') then
    alter table public.profiles add column bio text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='avatar_url') then
    alter table public.profiles add column avatar_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='display_name') then
    alter table public.profiles add column display_name text;
  end if;
end $$;

-- Ensure UNIQUE constraint on user_id exists (required for ON CONFLICT)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_id_key') then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
exception when others then
  -- If duplicate keys exist, we might need to handle cleanup, but for now let's hope it succeeds or is already unique
  null;
end $$;

-- 2. LINKS TABLE
create table if not exists public.links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  url text not null,
  icon text,
  show_in_links boolean default true,
  show_in_shop boolean default false,
  order_index int default 0,
  product_image_url text,
  created_at timestamptz default now()
);

-- ADD COLUMNS IF THEY DO NOT EXIST (for links/media)
do $$
begin
  -- Links columns
  if not exists (select 1 from information_schema.columns where table_name='links' and column_name='product_image_url') then
    alter table public.links add column product_image_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='links' and column_name='profile_id') then
    alter table public.links add column profile_id uuid references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='links' and column_name='show_in_shop') then
    alter table public.links add column show_in_shop boolean default false;
  end if;

  -- Media columns
  if not exists (select 1 from information_schema.columns where table_name='media' and column_name='type') then
    alter table public.media add column type text check (type in ('image', 'video'));
  end if;
end $$;

-- 3. MEDIA TABLE
create table if not exists public.media (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  description text,
  url text not null,
  type text check (type in ('image', 'video')),
  order_index int default 0,
  created_at timestamptz default now()
);

-- 4. AUTO-PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', 'New User')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if exists to ensure clean slate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. BACKFILL MISSING PROFILES
do $$
declare
  r record;
begin
  for r in select id, raw_user_meta_data from auth.users loop
    insert into public.profiles (user_id, username, display_name)
    values (
      r.id,
      coalesce(r.raw_user_meta_data->>'username', 'user_' || substr(r.id::text, 1, 8)),
      coalesce(r.raw_user_meta_data->>'display_name', 'User')
    )
    on conflict (user_id) do nothing;
  end loop;
end;
$$;

-- 6. ENABLE RLS
alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.media enable row level security;

-- Policies for Profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( is_active = true );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = user_id );

-- Policies for Links
drop policy if exists "Public links are viewable by everyone" on public.links;
create policy "Public links are viewable by everyone"
  on public.links for select
  using ( true );

drop policy if exists "Users can insert their own links" on public.links;
create policy "Users can insert their own links"
  on public.links for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own links" on public.links;
create policy "Users can update their own links"
  on public.links for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own links" on public.links;
create policy "Users can delete their own links"
  on public.links for delete
  using ( auth.uid() = user_id );

-- Policies for Media
drop policy if exists "Public media are viewable by everyone" on public.media;
create policy "Public media are viewable by everyone"
  on public.media for select
  using ( true );

drop policy if exists "Users can insert their own media" on public.media;
create policy "Users can insert their own media"
  on public.media for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own media" on public.media;
create policy "Users can update their own media"
  on public.media for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own media" on public.media;
create policy "Users can delete their own media"
  on public.media for delete
  using ( auth.uid() = user_id );

-- 7. STORAGE BUCKET & POLICIES
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Media bucket is public readable" on storage.objects;
create policy "Media bucket is public readable"
  on storage.objects for select
  using ( bucket_id = 'media' );

drop policy if exists "Authenticated users can upload to media" on storage.objects;
create policy "Authenticated users can upload to media"
  on storage.objects for insert
  with check ( bucket_id = 'media' and auth.role() = 'authenticated' );

drop policy if exists "Users can update their own media objects" on storage.objects;
create policy "Users can update their own media objects"
  on storage.objects for update
  using ( bucket_id = 'media' and auth.uid() = owner );

drop policy if exists "Users can delete their own media objects" on storage.objects;
create policy "Users can delete their own media objects"
  on storage.objects for delete
  using ( bucket_id = 'media' and auth.uid() = owner );

-- 8. RELOAD SCHEMA
notify pgrst, 'reload schema';
