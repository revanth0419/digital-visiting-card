
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Cast supabase to any to avoid type errors during development
const supabaseClient = supabase as any;

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface UserProfile {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
}

export default function Messages() {
    const { userId } = useParams<{ userId?: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<UserProfile[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    // Search & Presence State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Initialize Session & Presence
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                navigate("/auth");
                return;
            }
            setCurrentUserId(session.user.id);
            fetchConversations(session.user.id);

            // Initialize Presence
            const presenceChannel = supabaseClient.channel('presence_v1', {
                config: {
                    presence: {
                        key: session.user.id,
                    },
                },
            });

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    const newState = presenceChannel.presenceState();
                    const onlineIds = new Set<string>(Object.keys(newState));
                    setOnlineUsers(onlineIds);
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await presenceChannel.track({
                            online_at: new Date().toISOString(),
                            user_id: session.user.id,
                        });
                    }
                });

            return () => {
                supabaseClient.removeChannel(presenceChannel);
            };
        };
        init();
    }, [navigate]);

    // 2. Fetch Conversations (Distinct users)
    const fetchConversations = async (myId: string) => {
        setLoading(true);
        try {
            // Fetch sent messages
            const { data: sent } = await supabaseClient
                .from("messages")
                .select("receiver_id")
                .eq("sender_id", myId);

            // Fetch received messages
            const { data: received } = await supabaseClient
                .from("messages")
                .select("sender_id")
                .eq("receiver_id", myId);

            const contactIds = new Set<string>();
            sent?.forEach((m: any) => contactIds.add(m.receiver_id));
            received?.forEach((m: any) => contactIds.add(m.sender_id));

            // If a specific user is requested via URL but not in history, add them to fetch list
            if (userId && userId !== myId) contactIds.add(userId);

            if (contactIds.size > 0) {
                const { data: profiles } = await supabaseClient
                    .from("profiles")
                    .select("user_id, username, display_name, avatar_url")
                    .in("user_id", Array.from(contactIds));

                if (profiles) setConversations(profiles);

                // Select the active user if userId param exists
                if (userId) {
                    const active = profiles?.find(p => p.user_id === userId);
                    if (active) setSelectedUser(active);
                }
            }
        } catch (error) {
            console.error("Error fetching conversations:", error);
        } finally {
            setLoading(false);
        }
    };

    // 3. Search Users
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            const { data } = await supabaseClient
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
                .limit(5);

            if (data) setSearchResults(data);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // 3. Fetch Messages for Selected User
    useEffect(() => {
        if (!selectedUser || !currentUserId) return;

        const fetchMessages = async () => {
            const { data } = await supabaseClient
                .from("messages")
                .select("*")
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUserId})`)
                .order("created_at", { ascending: true });

            if (data) setMessages(data);
        };

        fetchMessages();

        // Subscribe to new messages
        const channel = supabaseClient
            .channel("messages")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    if (newMsg.sender_id === selectedUser.user_id) {
                        setMessages((prev) => [...prev, newMsg]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [selectedUser, currentUserId]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !selectedUser || !currentUserId) return;

        setSending(true);
        try {
            const { data, error } = await supabaseClient
                .from("messages")
                .insert({
                    sender_id: currentUserId,
                    receiver_id: selectedUser.user_id,
                    content: newMessage
                })
                .select()
                .single();

            if (error) throw error;

            setMessages((prev) => [...prev, data]);
            setNewMessage("");

            // Update conversations if it's a new one
            if (!conversations.find(c => c.user_id === selectedUser.user_id)) {
                setConversations(prev => [selectedUser, ...prev]);
            }

        } catch (error) {
            toast({ title: "Error sending message", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    const isOnline = (uid: string) => onlineUsers.has(uid);

    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* Sidebar: Conversations List */}
            <div className={`w-full md:w-80 border-r flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="font-bold text-xl">Messages</h1>
                </div>

                {/* Search Bar */}
                <div className="p-4 pb-0">
                    <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mb-4"
                    />
                </div>

                <ScrollArea className="flex-1">
                    {/* Search Results */}
                    {searchQuery && (
                        <div className="mb-4 border-b pb-2">
                            <p className="px-4 text-xs font-semibold text-muted-foreground mb-2">Search Results</p>
                            {searchResults.map(user => (
                                <div
                                    key={user.user_id}
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setSearchQuery(""); // Clear search on select
                                        if (!conversations.find(c => c.user_id === user.user_id)) {
                                            setConversations(prev => [user, ...prev]);
                                        }
                                        navigate(`/messages/${user.user_id}`);
                                    }}
                                    className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                    <div className="relative">
                                        <Avatar>
                                            <AvatarImage src={user.avatar_url || ""} />
                                            <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        {isOnline(user.user_id) && (
                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="font-semibold truncate">{user.display_name || user.username}</h3>
                                        <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                                    </div>
                                </div>
                            ))}
                            {searchResults.length === 0 && <p className="px-4 text-sm text-muted-foreground">No users found.</p>}
                        </div>
                    )}

                    {/* Conversations */}
                    {loading ? (
                        <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : conversations.length === 0 && !searchQuery ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No conversations yet.</p>
                        </div>
                    ) : (
                        conversations.map(user => (
                            <div
                                key={user.user_id}
                                onClick={() => {
                                    setSelectedUser(user);
                                    navigate(`/messages/${user.user_id}`);
                                }}
                                className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedUser?.user_id === user.user_id ? 'bg-muted' : ''}`}
                            >
                                <div className="relative">
                                    <Avatar>
                                        <AvatarImage src={user.avatar_url || ""} />
                                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {isOnline(user.user_id) && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="font-semibold truncate">{user.display_name || user.username}</h3>
                                    <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                                </div>
                            </div>
                        ))
                    )}
                </ScrollArea>
            </div>

            {/* Chat Area */}
            {selectedUser ? (
                <div className="flex-1 flex flex-col h-full w-full">
                    {/* Chat Header */}
                    <div className="p-4 border-b flex items-center gap-3 shadow-sm bg-background/80 backdrop-blur-md z-10">
                        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => {
                            setSelectedUser(null);
                            navigate("/messages");
                        }}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="relative">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={selectedUser.avatar_url || ""} />
                                <AvatarFallback>{selectedUser.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {isOnline(selectedUser.user_id) && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                            )}
                        </div>
                        <div>
                            <h2 className="font-bold">{selectedUser.display_name || selectedUser.username}</h2>
                            <p className="text-xs text-muted-foreground">
                                {isOnline(selectedUser.user_id) ? "Online" : "Offline"}
                            </p>
                        </div>
                    </div>

                    {/* Messages List */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4 max-w-3xl mx-auto">
                            {messages.map((msg, index) => {
                                const isMe = msg.sender_id === currentUserId;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'}`}>
                                            <p className="break-words">{msg.content}</p>
                                            <span className="text-[10px] opacity-70 block text-right mt-1">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-background">
                        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
                            <Input
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 rounded-full"
                            />
                            <Button type="submit" size="icon" disabled={sending || !newMessage.trim()} className="rounded-full">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    <p>Select a conversation to start chatting</p>
                </div>
            )}
        </div>
    );
}
