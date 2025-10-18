-- Add column to distinguish shopping links from regular links
ALTER TABLE public.links 
ADD COLUMN is_shopping_link boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_links_is_shopping_link ON public.links(is_shopping_link);