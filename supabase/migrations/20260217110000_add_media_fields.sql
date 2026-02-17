-- Add author and artist columns to links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE links ADD COLUMN IF NOT EXISTS artist TEXT;

-- Ensure category column exists (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'category') THEN
        ALTER TABLE links ADD COLUMN category TEXT DEFAULT 'link';
    END IF;
END $$;
