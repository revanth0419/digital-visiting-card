-- Add missing columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS public_phone text,
ADD COLUMN IF NOT EXISTS public_email text;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
