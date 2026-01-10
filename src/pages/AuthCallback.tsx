import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                const code = new URL(window.location.href).searchParams.get("code");

                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                } else {
                    // If no code is present, check if we already have a session
                    const { error } = await supabase.auth.getSession();
                    if (error) throw error;
                }

                navigate("/dashboard");
            } catch (error: any) {
                console.error("Error exchanging code for session:", error);
                setError(error.message);
                setTimeout(() => navigate("/auth"), 3000);
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
