-- Add new customization columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS layout_style TEXT DEFAULT 'list',
ADD COLUMN IF NOT EXISTS profile_theme TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS background_url TEXT,
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'gradient';

-- Add check constraints
ALTER TABLE profiles
ADD CONSTRAINT layout_style_check CHECK (layout_style IN ('list', 'grid', 'card')),
ADD CONSTRAINT profile_theme_check CHECK (profile_theme IN ('default', 'dark', 'light', 'gradient', 'minimal'));

-- Comment for documentation
COMMENT ON COLUMN profiles.layout_style IS 'User preferred layout: list, grid, or card';
COMMENT ON COLUMN profiles.profile_theme IS 'User selected theme: default, dark, light, gradient, minimal';
COMMENT ON COLUMN profiles.background_url IS 'Custom background image URL';
COMMENT ON COLUMN profiles.background_type IS 'Background type: gradient or image';