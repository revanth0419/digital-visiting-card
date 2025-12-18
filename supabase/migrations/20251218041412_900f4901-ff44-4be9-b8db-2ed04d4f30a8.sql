-- Add visibility column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS show_on_profile boolean DEFAULT true;

-- Create music_tracks table to save generated music
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  prompt text,
  genre text,
  mood text,
  language text,
  has_vocals boolean DEFAULT true,
  lyrics text,
  audio_url text,
  cover_image_url text,
  show_on_profile boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on music_tracks
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies for music_tracks
CREATE POLICY "Users can view their own music tracks" 
ON public.music_tracks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public music tracks" 
ON public.music_tracks 
FOR SELECT 
USING (show_on_profile = true);

CREATE POLICY "Users can create their own music tracks" 
ON public.music_tracks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music tracks" 
ON public.music_tracks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music tracks" 
ON public.music_tracks 
FOR DELETE 
USING (auth.uid() = user_id);