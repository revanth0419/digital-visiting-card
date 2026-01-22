-- Ensure links table has required columns
ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS show_in_shop boolean DEFAULT false;

ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.links
ADD COLUMN IF NOT EXISTS product_image_url text;

-- Add foreign key to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'links_user_id_fkey'
  ) THEN
    ALTER TABLE public.links
    ADD CONSTRAINT links_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for ordering
CREATE INDEX IF NOT EXISTS links_user_order_idx
ON public.links(user_id, order_index);
