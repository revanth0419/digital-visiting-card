import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const RedirectToProfile = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const resolveProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate("/auth");
                return;
            }

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("username")
                .eq("user_id", user.id)
                .single();

            if (error || !profile?.username) {
                setError("Profile not found. Please complete your profile setup.");
                // Optional: navigate to setup page if you have one
            } else {
                // Redirect to the public profile route
                navigate(`/u/${profile.username}`, { replace: true });
            }
        };

        resolveProfile();
    }, [navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="text-center p-4">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="text-primary hover:underline"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
};

export default RedirectToProfile;
