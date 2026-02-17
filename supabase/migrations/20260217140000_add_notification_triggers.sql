-- Function to handle notifications for new content
CREATE OR REPLACE FUNCTION handle_new_content_notification()
RETURNS TRIGGER AS $$
DECLARE
    subscriber RECORD;
    actor_name TEXT;
    notification_type TEXT;
    content_title TEXT;
    notification_message TEXT;
BEGIN
    -- Get actor's display name or username
    SELECT COALESCE(display_name, username, 'A user') INTO actor_name
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    -- Determine type and message based on the table
    IF TG_TABLE_NAME = 'links' THEN
        content_title := NEW.title;
        IF NEW.category = 'book' THEN
            notification_type := 'add_book';
            notification_message := actor_name || ' added a new book: ' || content_title;
        ELSE
            notification_type := 'add_link';
            notification_message := actor_name || ' added a new link: ' || content_title;
        END IF;
    ELSIF TG_TABLE_NAME = 'media' THEN
        content_title := NEW.title;
        notification_type := 'add_media'; -- Ensure this type is allowed in check constraint if strict, otherwise text is fine
        -- Note: The check constraint in previous migration was:
        -- CHECK (type IN ('add_link', 'add_book', 'update_profile', 'connection'))
        -- We might need to alter the constraint or just use 'update_profile' as a fallback, 
        -- but better to add 'add_media' to the check constraint if possible, or just insert text if check isn't enforced strictly yet.
        -- Let's assume we can insert 'add_media' or map it.
        notification_message := actor_name || ' added a new ' || NEW.type || ': ' || content_title;
    END IF;

    -- Loop through ALL users (except the actor)
    FOR subscriber IN
        SELECT user_id as subscriber_id
        FROM public.profiles
        WHERE user_id != NEW.user_id
    LOOP
        INSERT INTO public.notifications (recipient_id, actor_id, type, message)
        VALUES (subscriber.subscriber_id, NEW.user_id, notification_type, notification_message);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers to avoid duplication/errors
DROP TRIGGER IF EXISTS on_link_created ON public.links;
DROP TRIGGER IF EXISTS on_media_created ON public.media;

-- Create Trigger for Links
CREATE TRIGGER on_link_created
AFTER INSERT ON public.links
FOR EACH ROW EXECUTE FUNCTION handle_new_content_notification();

-- Create Trigger for Media
CREATE TRIGGER on_media_created
AFTER INSERT ON public.media
FOR EACH ROW EXECUTE FUNCTION handle_new_content_notification();

-- Update valid types constraint if necessary (safe attempt)
-- This block tries to update existing check constraint if it exists
DO $$
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('add_link', 'add_book', 'add_media', 'update_profile', 'connection'));
EXCEPTION
    WHEN OTHERS THEN NULL; -- Ignore if table doesn't exist or other error
END $$;
