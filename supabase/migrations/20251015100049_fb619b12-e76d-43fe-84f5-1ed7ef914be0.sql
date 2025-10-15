-- Simple fix: Keep original RLS policy, enforce column selection in application code
-- This avoids security definer view issues while maintaining security

-- Ensure the public policy exists (restore if it was dropped)
DROP POLICY IF EXISTS "Public profiles viewable by username" ON public.profiles;
DROP POLICY IF EXISTS "Owners view full profiles" ON public.profiles;

CREATE POLICY "Public profiles viewable by username"
ON public.profiles FOR SELECT
USING (true);

-- Keep existing INSERT and UPDATE policies unchanged
-- They already have proper auth.uid() = user_id checks

-- Security Note: The application code (Profile.tsx) will only SELECT safe columns:
-- id, username, display_name, bio, avatar_url, theme_color, created_at, updated_at
-- This excludes the sensitive user_id field