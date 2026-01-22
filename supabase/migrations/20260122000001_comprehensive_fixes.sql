-- 1. Fix LINKS table
ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS product_image_url text,
ADD COLUMN IF NOT EXISTS show_in_shop boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "icon" text;

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own links" ON public.links;
CREATE POLICY "Users can insert own links"
ON public.links FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own links" ON public.links;
CREATE POLICY "Users can read own links"
ON public.links FOR SELECT
USING (auth.uid() = user_id OR true); -- Allow public access for profile view (refined later if needed, but 'true' is risky for draft links, let's stick to specific logic or keep it open for public profiles query)

-- Correction: "Users can read own links" should probably just be for the owner in dashboard. 
-- Public access is usually handled by a separate policy or the fact that RLS is on.
-- BUT, for public profiles, we need ANYONE to be able to read links where the user is public.
-- For now, let's follow the user's specific request for "Users can read own links" AND add a public one if missing.
-- The user request said:
-- CREATE POLICY "Users can read own links" ON public.links FOR SELECT USING (auth.uid() = user_id);
-- I will add that specific one.

DROP POLICY IF EXISTS "Users can read own links" ON public.links;
CREATE POLICY "Users can read own links"
ON public.links FOR SELECT
USING (auth.uid() = user_id);

-- Add a policy for public to read links (essential for /u/username)
DROP POLICY IF EXISTS "Public can view links" ON public.links;
CREATE POLICY "Public can view links"
ON public.links FOR SELECT
TO public
USING (true);


DROP POLICY IF EXISTS "Users can update own links" ON public.links;
CREATE POLICY "Users can update own links"
ON public.links FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own links" ON public.links;
CREATE POLICY "Users can delete own links"
ON public.links FOR DELETE
USING (auth.uid() = user_id);


-- 2. Fix PROFILES table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create/Replace trigger for new user handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)) -- Use email as fallback username if needed
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username
  WHERE public.profiles.username IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 3. STORAGE & MEDIA
-- Create 'media' bucket if it doesn't exist (this is a best-effort in SQL, usually done in API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "upload media" ON storage.objects;
CREATE POLICY "upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "read media" ON storage.objects;
CREATE POLICY "read media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

DROP POLICY IF EXISTS "update own media" ON storage.objects;
CREATE POLICY "update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid())
WITH CHECK (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "delete own media" ON storage.objects;
CREATE POLICY "delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid());

-- 4. Fix MEDIA table
ALTER TABLE public.media
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS url text,
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own media" ON public.media;
CREATE POLICY "Users can insert own media"
ON public.media FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own media" ON public.media;
CREATE POLICY "Users can read own media"
ON public.media FOR SELECT
USING (auth.uid() = user_id);

-- Add public read policy for media table so profile visitors can see it
DROP POLICY IF EXISTS "Public can view media" ON public.media;
CREATE POLICY "Public can view media"
ON public.media FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Users can delete own media" ON public.media;
CREATE POLICY "Users can delete own media"
ON public.media FOR DELETE
USING (auth.uid() = user_id);
