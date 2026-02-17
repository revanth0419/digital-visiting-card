
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { ConnectButton } from "@/components/profile/ConnectButton";

interface ConnectedUser {
    id: string; // The user's ID
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
}

export default function Connections() {
    const navigate = useNavigate();
    const [connections, setConnections] = useState<ConnectedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/auth");
                return;
            }
            setCurrentUserId(session.user.id);

            // 1. Fetch Following IDs
            const { data: followingData } = await supabase
                .from("subscriptions")
                .select("subscribed_to_id")
                .eq("subscriber_id", session.user.id);

            // 2. Fetch Followers IDs
            const { data: followersData } = await supabase
                .from("subscriptions")
                .select("subscriber_id")
                .eq("subscribed_to_id", session.user.id);

            const userIds = new Set<string>();
            if (followingData) followingData.forEach((i: any) => userIds.add(i.subscribed_to_id));
            if (followersData) followersData.forEach((i: any) => userIds.add(i.subscriber_id));

            if (userIds.size > 0) {
                // 3. Fetch Profiles for these IDs
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, username, display_name, avatar_url, bio")
                    .in("user_id", Array.from(userIds));

                 if (profiles) {
                    const mappedProfiles = profiles.map((p: any) => ({
                        id: p.user_id,
                        username: p.username,
                        display_name: p.display_name,
                        avatar_url: p.avatar_url,
                        bio: p.bio
                    }));
                    setConnections(mappedProfiles);
                 }
            } else {
                setConnections([]);
            }

        } catch (error) {
            console.error("Error fetching connections:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="container max-w-3xl mx-auto px-4 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard")}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Dashboard
                    </Button>
                    <h1 className="text-3xl font-bold">Connections</h1>
                </div>

                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : (
                    <div className="space-y-4">
                        {connections.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No connections yet.
                            </div>
                        ) : (
                            connections.map((user) => (
                                <Card key={user.id} className="p-4 flex items-center gap-4 bg-card/50 backdrop-blur-sm border-border/50">
                                    <Avatar
                                        className="w-12 h-12 border border-primary/20 cursor-pointer"
                                        onClick={() => navigate(`/u/${user.username}`)}
                                    >
                                        <AvatarImage src={user.avatar_url || undefined} />
                                        <AvatarFallback>
                                            {(user.display_name || user.username || '?').charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/u/${user.username}`)}>
                                        <h3 className="font-semibold truncate">
                                            {user.display_name || user.username}
                                        </h3>
                                        <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => navigate(`/u/${user.username}`)}>
                                            View Profile
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
