-- Fix SECURITY DEFINER view issue by recreating with explicit security setting
-- Drop and recreate the view with SECURITY INVOKER to use the querying user's permissions

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  display_name,
  bio,
  avatar_url,
  theme_color,
  created_at,
  updated_at,
  layout_style,
  profile_theme,
  background_url,
  background_type
FROM public.profiles;

-- Grant public read access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS 'Public-facing profile data that excludes sensitive user_id field. Uses SECURITY INVOKER for proper RLS enforcement.';