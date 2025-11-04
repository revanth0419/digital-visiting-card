-- Add show_in_links column to links table
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS show_in_links boolean NOT NULL DEFAULT true;

-- Update existing records to show in links by default
UPDATE public.links 
SET show_in_links = true 
WHERE show_in_links IS NULL;