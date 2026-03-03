import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
});

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Handle password recovery routing globally
                if (event === "PASSWORD_RECOVERY") {
                    console.log("AuthProvider: Password recovery mode detected globally. Routing to reset-password.");
                    // Check if we are already on the reset-password page to avoid infinite loops, but we use window URL
                    if (!window.location.pathname.includes('/update-password')) {
                        window.location.href = "/update-password";
                    }
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const value = {
        session,
        user,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
