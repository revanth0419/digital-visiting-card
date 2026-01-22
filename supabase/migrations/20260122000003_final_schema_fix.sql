-- Final Schema Fixes for Profiles, Links, and Media

-- 1. Ensure PROFILES table has all required columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS layout_style text DEFAULT 'list',
ADD COLUMN IF NOT EXISTS profile_theme text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS background_type text DEFAULT 'gradient',
ADD COLUMN IF NOT EXISTS background_url text;

-- Ensure username uniqueness
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- Enable RLS on profiles if not already
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to profiles
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles"
ON public.profiles FOR SELECT
TO public
USING (true);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 2. Ensure LINKS table has all required columns
ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS product_image_url text,
ADD COLUMN IF NOT EXISTS show_in_links boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_shop boolean DEFAULT false;

-- Enable RLS on links
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

-- Allow public read access to links (Critical for View Profile)
DROP POLICY IF EXISTS "Public can view links" ON public.links;
CREATE POLICY "Public can view links"
ON public.links FOR SELECT
TO public
USING (true);

-- Allow users to manage their own links
DROP POLICY IF EXISTS "Users can insert own links" ON public.links;
CREATE POLICY "Users can insert own links"
ON public.links FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own links" ON public.links;
CREATE POLICY "Users can read own links"
ON public.links FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own links" ON public.links;
CREATE POLICY "Users can update own links"
ON public.links FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own links" ON public.links;
CREATE POLICY "Users can delete own links"
ON public.links FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Ensure MEDIA table has all required columns
ALTER TABLE public.media
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS url text,
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;

-- Enable RLS on media
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Allow public read access to media (Critical for View Profile)
DROP POLICY IF EXISTS "Public can view media" ON public.media;
CREATE POLICY "Public can view media"
ON public.media FOR SELECT
TO public
USING (true);

-- Allow users to manage their own media
DROP POLICY IF EXISTS "Users can insert own media" ON public.media;
CREATE POLICY "Users can insert own media"
ON public.media FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own media" ON public.media;
CREATE POLICY "Users can read own media"
ON public.media FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own media" ON public.media;
CREATE POLICY "Users can delete own media"
ON public.media FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. STORAGE Policies
-- Ensure 'media' bucket exists and is public (Best effort via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to 'media' bucket objects
DROP POLICY IF EXISTS "Public can view media bucket" ON storage.objects;
CREATE POLICY "Public can view media bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow authenticated users to upload to 'media' bucket
DROP POLICY IF EXISTS "Users can upload media bucket" ON storage.objects;
CREATE POLICY "Users can upload media bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow users to update/delete their own objects in 'media'
DROP POLICY IF EXISTS "Users can update own media bucket" ON storage.objects;
CREATE POLICY "Users can update own media bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete own media bucket" ON storage.objects;
CREATE POLICY "Users can delete own media bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid());

-- Reload schema caches
NOTIFY pgrst, 'reload schema';
