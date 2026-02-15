-- Create a function to check if an email already exists in auth.users
-- This function needs to be created with security definer to access auth.users
-- but we restrict it to only return a boolean, not user data.

CREATE OR REPLACE FUNCTION check_email_exists(email_arg text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = email_arg
  );
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION check_email_exists(text) TO anon, authenticated;
