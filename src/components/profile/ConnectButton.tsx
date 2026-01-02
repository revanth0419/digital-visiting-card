import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";

interface ConnectButtonProps {
    targetUserId: string;
    initialIsConnected: boolean;
    onConnectionChange?: (isConnected: boolean) => void;
    className?: string;
}

export const ConnectButton = ({ targetUserId, initialIsConnected, onConnectionChange, className }: ConnectButtonProps) => {
    const [isConnected, setIsConnected] = useState(initialIsConnected);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleConnect = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast({
                    title: "Please log in",
                    description: "You need to be logged in to connect with users.",
                    variant: "destructive",
                });
                return;
            }

            const endpoint = isConnected
                ? `/users/${targetUserId}/disconnect`
                : `/users/${targetUserId}/connect`;

            const { error } = await apiFetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });

            if (error) {
                throw new Error(error || "Failed to update connection");
            }

            const newStatus = !isConnected;
            setIsConnected(newStatus);
            if (onConnectionChange) {
                onConnectionChange(newStatus);
            }

            toast({
                title: newStatus ? "Connected!" : "Disconnected",
                description: newStatus ? "You are now following this user." : "You have unfollowed this user.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant={isConnected ? "outline" : "gradient"}
            size="sm"
            className={className}
            onClick={handleConnect}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isConnected ? (
                <UserCheck className="w-4 h-4 mr-2" />
            ) : (
                <UserPlus className="w-4 h-4 mr-2" />
            )}
            {isConnected ? "Connected" : "Connect"}
        </Button>
    );
};
