-- Create a public view that excludes user_id from profiles
-- This provides a safe way to query public profile data without exposing auth IDs

CREATE OR REPLACE VIEW public.public_profiles AS
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

-- Add a comment explaining the view's purpose
COMMENT ON VIEW public.public_profiles IS 'Public-facing profile data that excludes sensitive user_id field';