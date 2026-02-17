import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

            if (isConnected) {
                // Disconnect
                const { error } = await supabase
                    .from("subscriptions")
                    .delete()
                    .eq("subscriber_id", session.user.id)
                    .eq("subscribed_to_id", targetUserId);

                if (error) throw error;
            } else {
                // Connect
                const { error } = await supabase
                    .from("subscriptions")
                    .insert({
                        subscriber_id: session.user.id,
                        subscribed_to_id: targetUserId
                    });

                if (error) {
                    if (error.code === '23505') { // Unique violation
                        toast({
                            title: "Already connected",
                            description: "You are already following this user.",
                        });
                        setIsConnected(true);
                        return;
                    }
                    throw error;
                }

                // Create notification
                try {
                    // Get subscriber details
                    const { data: subscriberProfile } = await supabase
                        .from("profiles")
                        .select("username, display_name")
                        .eq("user_id", session.user.id)
                        .single();

                    const subscriberName = subscriberProfile?.display_name || subscriberProfile?.username || "Someone";

                    await supabase.from("notifications").insert({
                        recipient_id: targetUserId,
                        actor_id: session.user.id,
                        type: "connection",
                        message: `${subscriberName} connected with you`,
                        is_read: false
                    } as any);
                } catch (notifyError) {
                    console.error("Failed to send notification:", notifyError);
                }
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
            console.error("Connection error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to update connection",
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
