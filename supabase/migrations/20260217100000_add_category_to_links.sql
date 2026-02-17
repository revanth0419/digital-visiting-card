-- Add category column to links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'link';

-- Update existing links to have 'link' category
UPDATE links SET category = 'link' WHERE category IS NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);
