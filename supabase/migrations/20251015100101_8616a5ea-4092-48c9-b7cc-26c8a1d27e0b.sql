-- Clean up: Remove the security definer view created in first migration
DROP VIEW IF EXISTS public.public_profiles CASCADE;