-- Ensure books table has the necessary columns for the generator
ALTER TABLE IF EXISTS public.books ADD COLUMN IF NOT EXISTS pages jsonb;
ALTER TABLE IF EXISTS public.books ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE IF EXISTS public.books ADD COLUMN IF NOT EXISTS end_image_url text;
