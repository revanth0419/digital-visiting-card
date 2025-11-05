-- First, drop the existing constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT layout_style_check;

-- Update any existing 'card' values to 'compact' (if any exist)
UPDATE public.profiles 
SET layout_style = 'list'
WHERE layout_style NOT IN ('list', 'grid');

-- Add the new constraint with 'compact' instead of 'card'
ALTER TABLE public.profiles 
ADD CONSTRAINT layout_style_check 
CHECK (layout_style = ANY (ARRAY['list'::text, 'grid'::text, 'compact'::text]));