# Storage Bucket Setup

If you're seeing "Bucket not found" errors, you need to create the storage buckets in your Supabase project.

## Quick Fix: Create Buckets via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Create a bucket named `media` with these settings:
   - **Name**: `media`
   - **Public bucket**: Unchecked (private)
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp,video/mp4,video/quicktime`
5. Click **Create bucket**

6. Create another bucket named `avatars` with these settings:
   - **Name**: `avatars`
   - **Public bucket**: Unchecked (private)
   - **File size limit**: 5242880 (5MB)
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp`
7. Click **Create bucket**

## Alternative: Run SQL Migration

You can also run this SQL in the Supabase SQL Editor:

```sql
-- Create storage buckets for avatars and media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;
```

## Storage Policies

After creating the buckets, ensure the storage policies are set up. These should be created by the migration file:
`supabase/migrations/20251014150044_4a7230f8-5f99-43e1-93a6-ed47a7458ea1.sql`

If policies are missing, you can run the full migration file in the Supabase SQL Editor.



