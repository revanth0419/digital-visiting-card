import { useState, useEffect } from "react";
import { Bell, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    username: string;
    avatar_url: string | null;
  };
}

const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);

      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          actor:profiles!actor_id(username, avatar_url)
        `)
        .eq("recipient_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return;
      }

      setNotifications((data as any) || []);
      setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${session.user.id}`
          },
          (payload) => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      }
    };

    fetchSession();

    // Fallback polling
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  };

  const markAllRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("recipient_id", session.user.id);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all read", error);
    }
  };

  if (!isAuthenticated) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-11 w-11">
            <Bell className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 backdrop-blur-xl bg-background/95">
          <DropdownMenuLabel className="text-center">Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            <Bell className="h-12 w-12 text-muted-foreground opacity-50" />
            <div className="space-y-1">
              <h4 className="font-medium">Sign in to view notifications</h4>
              <p className="text-sm text-muted-foreground">
                Join to see updates from people you follow.
              </p>
            </div>
            <Button onClick={() => navigate("/login")} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={(val) => {
      setOpen(val);
      if (val) {
        // Optional: mark all as read on open, or keep manual
        // markAllRead(); 
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 backdrop-blur-xl bg-background/95">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-xs text-primary">
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!notification.is_read ? "bg-accent/10" : ""}`}
                onClick={(e) => {
                  if (!notification.is_read) markAsRead(notification.id, e);
                }}
              >
                <div className="flex w-full items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={notification.actor?.avatar_url || ""} />
                    <AvatarFallback>{notification.actor?.username?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm leading-none ${!notification.is_read ? "font-semibold" : ""}`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      {!notification.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
