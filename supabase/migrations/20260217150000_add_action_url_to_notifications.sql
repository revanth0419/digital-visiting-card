-- Add action_url column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Update the notification trigger function
CREATE OR REPLACE FUNCTION handle_new_content_notification()
RETURNS TRIGGER AS $$
DECLARE
    subscriber RECORD;
    actor_username TEXT;
    actor_name TEXT;
    notification_type TEXT;
    content_title TEXT;
    notification_message TEXT;
    target_url TEXT;
BEGIN
    -- Get actor's details
    SELECT username, COALESCE(display_name, username, 'A user') 
    INTO actor_username, actor_name
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    -- Determine type, message, and target_url based on the table
    IF TG_TABLE_NAME = 'links' THEN
        content_title := NEW.title;
        target_url := NEW.url; -- Direct link to the content
        IF NEW.category = 'book' THEN
            notification_type := 'add_book';
            notification_message := actor_name || ' added a new book: ' || content_title;
        ELSE
            notification_type := 'add_link';
            notification_message := actor_name || ' added a new link: ' || content_title;
        END IF;
    ELSIF TG_TABLE_NAME = 'media' THEN
        content_title := NEW.title;
        notification_type := 'add_media';
        notification_message := actor_name || ' added a new ' || NEW.type || ': ' || content_title;
        -- For media, redirection goes to the user's profile
        -- We'll assume the client knows the base URL, or we can store the relative path
        target_url := '/u/' || actor_username;
    END IF;

    -- Loop through ALL users (except the actor)
    FOR subscriber IN
        SELECT user_id as subscriber_id
        FROM public.profiles
        WHERE user_id != NEW.user_id
    LOOP
        INSERT INTO public.notifications (recipient_id, actor_id, type, message, action_url)
        VALUES (subscriber.subscriber_id, NEW.user_id, notification_type, notification_message, target_url);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
