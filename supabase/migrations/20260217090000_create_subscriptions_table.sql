-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscribed_to_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscriber_id, subscribed_to_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = subscriber_id);

CREATE POLICY "Users can see who follows them"
ON public.subscriptions FOR SELECT
USING (auth.uid() = subscribed_to_id);

CREATE POLICY "Users can subscribe to others"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can unsubscribe"
ON public.subscriptions FOR DELETE
USING (auth.uid() = subscriber_id);
