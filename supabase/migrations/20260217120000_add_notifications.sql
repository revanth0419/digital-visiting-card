-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('add_link', 'add_book', 'update_profile', 'connection')),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = recipient_id);

-- Policy: System/Functions can insert notifications (or users triggering actions)
-- For simplicity, we allow authenticated users to insert notifications (e.g. when they perform an action)
-- In a stricter system, this might be done via Database Triggers. 
-- But for this app, we will insert from the client/edge function.
CREATE POLICY "Users can insert notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = recipient_id);
