
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { ButtonProps } from "@/components/ui/button";

interface UnreadMessagesBadgeProps extends ButtonProps {
    className?: string;
}

export const UnreadMessagesBadge = ({ className, ...props }: UnreadMessagesBadgeProps) => {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { count, error } = await supabase
                .from("messages" as any)
                .select("*", { count: 'exact', head: true })
                .eq("receiver_id", session.user.id)
                .eq("is_read", false);

            if (!error && count !== null) {
                setUnreadCount(count);
            }
        };

        fetchUnreadCount();

        // Subscribe to new messages
        const channel = supabase
            .channel("unread-messages")
            .on(
                "postgres_changes",
                {
                    event: "*", // Listen to all events to handle read updates too if possible, or just INSERT
                    schema: "public",
                    table: "messages",
                },
                (payload: any) => {
                    // We'll just refetch to be safe and accurate
                    fetchUnreadCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/messages")}
            title="Messages"
            className={`relative ${className}`}
            {...props}
        >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
                <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full animate-in zoom-in"
                >
                    {unreadCount}
                </Badge>
            )}
        </Button>
    );
};
