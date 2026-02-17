-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Users can insert messages where they are the sender
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- 2. Users can view messages they sent or received
CREATE POLICY "Users can view their own messages"
ON messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 3. Users can update (mark as read) messages they received
CREATE POLICY "Users can update read status of received messages"
ON messages FOR UPDATE
USING (auth.uid() = receiver_id);
