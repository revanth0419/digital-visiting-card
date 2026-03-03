import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
    const navigate = useNavigate();
    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            console.log("AuthCallback: Starting auth callback handling...");
            try {
                const params = new URLSearchParams(window.location.search);
                const code = params.get("code");
                const next = params.get("next");
                const errorParam = params.get("error");
                const errorDescription = params.get("error_description");

                console.log("AuthCallback Params:", { code: !!code, next, error: errorParam, errorDescription });

                if (errorParam) {
                    throw new Error(errorDescription || errorParam);
                }

                if (code) {
                    console.log("AuthCallback: Exchanging code for session...");
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        console.error("AuthCallback: Exchange error:", error);
                        throw error;
                    }
                    console.log("AuthCallback: Session exchanged successfully", { user: data.session?.user?.id });
                } else {
                    console.log("AuthCallback: No code, checking existing session...");
                    // If no code is present, check if we already have a session
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error) throw error;
                    if (!session) {
                        console.log("AuthCallback: No session found, redirecting to auth");
                        throw new Error("No session found");
                    }
                    console.log("AuthCallback: Existing session found", { user: session.user.id });
                }

                console.log("AuthCallback: Redirecting to:", next || "/dashboard");
                // Small delay to ensure state updates propagate
                setTimeout(() => {
                    if (next) {
                        navigate(next);
                    } else {
                        navigate("/dashboard");
                    }
                }, 500);

            } catch (error: any) {
                console.error("Error exchanging code for session:", error);
                setError(error.message);
                // Don't redirect immediately on error, let user see it
            } finally {
                setVerifying(false);
            }
        };

        handleAuthCallback();
    }, [navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <p className="text-red-500 mb-4 font-semibold">Authentication Error</p>
                <p className="text-muted-foreground mb-4">{error}</p>
                <button
                    onClick={() => navigate("/auth")}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <span className="text-muted-foreground">Verifying secure connection...</span>
        </div>
    );
};

export default AuthCallback;
