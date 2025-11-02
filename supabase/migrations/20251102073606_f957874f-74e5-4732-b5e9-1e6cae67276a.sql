-- Add missing server-side input validation constraints
ALTER TABLE profiles
ADD CONSTRAINT bio_length CHECK (char_length(bio) <= 500),
ADD CONSTRAINT display_name_length CHECK (char_length(display_name) <= 100),
ADD CONSTRAINT theme_color_format CHECK (theme_color ~ '^#[0-9a-fA-F]{6}$'),
ADD CONSTRAINT unique_username UNIQUE (username);

ALTER TABLE links
ADD CONSTRAINT title_length CHECK (char_length(title) BETWEEN 1 AND 200),
ADD CONSTRAINT icon_length CHECK (char_length(icon) <= 10),
ADD CONSTRAINT url_protocol CHECK (url ~ '^https?://');

ALTER TABLE media
ADD CONSTRAINT media_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
ADD CONSTRAINT media_desc_length CHECK (char_length(description) <= 1000);

-- Add resource limits to prevent abuse
CREATE OR REPLACE FUNCTION check_links_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM links WHERE profile_id = NEW.profile_id) >= 50 THEN
    RAISE EXCEPTION 'Maximum 50 links per profile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_links_limit
BEFORE INSERT ON links
FOR EACH ROW EXECUTE FUNCTION check_links_limit();

CREATE OR REPLACE FUNCTION check_media_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM media WHERE profile_id = NEW.profile_id) >= 100 THEN
    RAISE EXCEPTION 'Maximum 100 media items per profile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_media_limit
BEFORE INSERT ON media
FOR EACH ROW EXECUTE FUNCTION check_media_limit();

-- Make storage buckets private for signed URL security
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('avatars', 'media');