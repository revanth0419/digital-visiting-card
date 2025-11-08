import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Search as SearchIcon, UserPlus, UserCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  user_id: string;
  isSubscribed?: boolean;
}

export default function Search() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchProfiles();
    } else {
      setProfiles([]);
    }
  }, [searchQuery]);

  const searchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;

      if (data && currentUserId) {
        // Check subscription status for each profile
        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("subscribed_to_id")
          .eq("subscriber_id", currentUserId);

        const subscribedIds = new Set(subscriptions?.map(s => s.subscribed_to_id) || []);
        
        const profilesWithStatus = data
          .filter(p => p.user_id !== currentUserId)
          .map(p => ({
            ...p,
            isSubscribed: subscribedIds.has(p.user_id)
          }));

        setProfiles(profilesWithStatus);
      }
    } catch (error) {
      console.error("Error searching profiles:", error);
      toast.error("Failed to search profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (profile: Profile) => {
    if (!currentUserId) {
      toast.error("Please log in to subscribe");
      return;
    }

    try {
      if (profile.isSubscribed) {
        // Unsubscribe
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("subscriber_id", currentUserId)
          .eq("subscribed_to_id", profile.user_id);

        if (error) throw error;
        toast.success(`Unsubscribed from ${profile.display_name || profile.username}`);
      } else {
        // Subscribe
        const { error } = await supabase
          .from("subscriptions")
          .insert({
            subscriber_id: currentUserId,
            subscribed_to_id: profile.user_id
          });

        if (error) throw error;
        toast.success(`Subscribed to ${profile.display_name || profile.username}`);
      }

      // Update local state
      setProfiles(profiles.map(p => 
        p.id === profile.id ? { ...p, isSubscribed: !p.isSubscribed } : p
      ));
    } catch (error) {
      console.error("Error toggling subscription:", error);
      toast.error("Failed to update subscription");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Discover Profiles
            </h1>
            <p className="text-muted-foreground">Find and subscribe to other users</p>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>

          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Searching...
            </div>
          )}

          <div className="space-y-4">
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm border-border/50">
                  <div className="flex items-center gap-4">
                    <Avatar
                      className="w-16 h-16 border-2 border-primary/20 cursor-pointer"
                      onClick={() => navigate(`/u/${profile.username}`)}
                    >
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-lg font-semibold">
                        {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/u/${profile.username}`)}
                    >
                      <h3 className="font-semibold text-lg">
                        {profile.display_name || profile.username}
                      </h3>
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                      {profile.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {profile.bio}
                        </p>
                      )}
                    </div>

                    <Button
                      variant={profile.isSubscribed ? "secondary" : "default"}
                      size="sm"
                      onClick={() => handleSubscribe(profile)}
                      className="min-w-[100px]"
                    >
                      {profile.isSubscribed ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Subscribed
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Subscribe
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {searchQuery && !loading && profiles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No profiles found matching "{searchQuery}"
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}