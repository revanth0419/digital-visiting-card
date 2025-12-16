import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  user_id?: string; // Optional since public_profiles doesn't have it
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
  }, [searchQuery, currentUserId]);

  const searchProfiles = async () => {
    setLoading(true);
    try {
      // Search profiles using public_profiles view to avoid exposing user_id
      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles")
        .select("*")
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (profilesError) throw profilesError;

      if (profilesData) {
        // For public search, we don't check subscriptions since we don't have user_id
        // Filter out any null username entries
        const validProfiles = profilesData.filter(p => p.username && p.id);
        setProfiles(validProfiles.map(p => ({
          ...p,
          id: p.id!,
          username: p.username,
          isSubscribed: false
        })));
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

    // Since public_profiles doesn't have user_id, subscription via search is disabled
    // Users can subscribe from the profile page directly
    toast.error("Please visit the profile page to subscribe");
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
                        {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
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
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/u/${profile.username}`)}
                      className="min-w-[100px]"
                    >
                      View Profile
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
