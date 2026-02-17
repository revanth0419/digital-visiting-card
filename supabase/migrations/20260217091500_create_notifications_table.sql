-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'connection', 'profile_update', 'link_added', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark read)"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Start simplified: Users can insert notifications for others (e.g. when connecting)
-- In a stricter system, we might use a trigger or database function.
CREATE POLICY "Users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);
