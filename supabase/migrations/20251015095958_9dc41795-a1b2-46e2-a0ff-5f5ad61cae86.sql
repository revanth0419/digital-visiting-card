-- Fix security vulnerability: Remove user_id exposure from public profiles
-- Create a public view that excludes sensitive user_id field

-- Drop the overly permissive RLS policy
DROP POLICY IF EXISTS "Public profiles viewable by username" ON public.profiles;

-- Create a secure public view without user_id
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  bio,
  avatar_url,
  theme_color,
  created_at,
  updated_at
FROM public.profiles;

-- Grant SELECT access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create restrictive policy: only owners can view full profiles table
CREATE POLICY "Owners view full profiles"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Keep existing INSERT and UPDATE policies (they already check ownership)
-- These remain unchanged:
-- "Users can insert own profile" - already has auth.uid() = user_id check
-- "Users can update own profile" - already has auth.uid() = user_id check