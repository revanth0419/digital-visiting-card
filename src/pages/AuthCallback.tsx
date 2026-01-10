
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            const { error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error exchanging code for session:", error);
                setError(error.message);
                // Optionally redirect to auth with error after a delay
                setTimeout(() => navigate("/auth"), 3000);
            } else {
                console.log("Session established successfully");
                // Check if it's a password recovery flow
                const { data: { user } } = await supabase.auth.getUser();

                // If we just recovered a password, we might want to go to reset password page, 
                // but usually the link type tells us. 
                // However, Supabase redirect handling is a bit tricky. 
                // If the user just clicked a magic link or signup confirmation:
                navigate("/dashboard");
            }
        };

        handleAuthCallback();
    }, [navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <p className="text-red-500 mb-4">Authentication Error: {error}</p>
                <p>Redirecting to login...</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Verifying authentication...</span>
        </div>
    );
};

export default AuthCallback;
