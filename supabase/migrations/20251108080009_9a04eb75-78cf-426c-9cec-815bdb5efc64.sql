-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscribed_to_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(subscriber_id, subscribed_to_id),
  CHECK (subscriber_id != subscribed_to_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Users can view who subscribed to them"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = subscribed_to_id);

CREATE POLICY "Users can create their own subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = subscriber_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notifications for subscribers when new content is added
CREATE OR REPLACE FUNCTION public.notify_subscribers_on_new_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  subscriber_record RECORD;
BEGIN
  -- Get profile info
  SELECT username, display_name INTO profile_record
  FROM profiles
  WHERE id = NEW.profile_id;

  -- Create notification for each subscriber
  FOR subscriber_record IN
    SELECT p.user_id
    FROM subscriptions s
    JOIN profiles p ON s.subscribed_to_id = p.user_id
    WHERE p.id = NEW.profile_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      subscriber_record.user_id,
      'new_link',
      'New Link Added',
      COALESCE(profile_record.display_name, profile_record.username) || ' added a new link: ' || NEW.title,
      '/u/' || profile_record.username
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for new links
CREATE TRIGGER on_new_link_notify_subscribers
  AFTER INSERT ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscribers_on_new_link();

-- Function to notify subscribers when new media is added
CREATE OR REPLACE FUNCTION public.notify_subscribers_on_new_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  subscriber_record RECORD;
BEGIN
  -- Get profile info
  SELECT username, display_name INTO profile_record
  FROM profiles
  WHERE id = NEW.profile_id;

  -- Create notification for each subscriber
  FOR subscriber_record IN
    SELECT p.user_id
    FROM subscriptions s
    JOIN profiles p ON s.subscribed_to_id = p.user_id
    WHERE p.id = NEW.profile_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      subscriber_record.user_id,
      'new_media',
      'New Media Added',
      COALESCE(profile_record.display_name, profile_record.username) || ' added new media: ' || NEW.title,
      '/u/' || profile_record.username
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for new media
CREATE TRIGGER on_new_media_notify_subscribers
  AFTER INSERT ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscribers_on_new_media();