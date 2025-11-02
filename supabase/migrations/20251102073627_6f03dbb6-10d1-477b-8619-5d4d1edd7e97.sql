-- Fix function search_path security warnings
DROP TRIGGER IF EXISTS enforce_links_limit ON links;
DROP TRIGGER IF EXISTS enforce_media_limit ON media;
DROP FUNCTION IF EXISTS check_links_limit();
DROP FUNCTION IF EXISTS check_media_limit();

-- Recreate functions with search_path set
CREATE OR REPLACE FUNCTION check_links_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM links WHERE profile_id = NEW.profile_id) >= 50 THEN
    RAISE EXCEPTION 'Maximum 50 links per profile';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_links_limit
BEFORE INSERT ON links
FOR EACH ROW EXECUTE FUNCTION check_links_limit();

CREATE OR REPLACE FUNCTION check_media_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM media WHERE profile_id = NEW.profile_id) >= 100 THEN
    RAISE EXCEPTION 'Maximum 100 media items per profile';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_media_limit
BEFORE INSERT ON media
FOR EACH ROW EXECUTE FUNCTION check_media_limit();