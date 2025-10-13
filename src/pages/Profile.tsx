import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Zap } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string | null;
};

type Link = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  order_index: number;
};

const Profile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError || !profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: linksData } = await supabase
        .from("links")
        .select("*")
        .eq("profile_id", profileData.id)
        .eq("is_active", true)
        .order("order_index");

      if (linksData) {
        setLinks(linksData);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The profile you're looking for doesn't exist.
          </p>
          <a href="/" className="text-primary hover:underline">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  const themeColor = profile.theme_color || "#8b5cf6";

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="text-center mb-8 animate-fade-in">
          <Avatar className="w-32 h-32 mx-auto mb-4 border-4 shadow-elegant" style={{ borderColor: themeColor }}>
            <AvatarImage src={profile.avatar_url || ""} alt={profile.display_name || profile.username} />
            <AvatarFallback className="text-3xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h1 className="text-3xl font-bold mb-2">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-muted-foreground mb-4">@{profile.username}</p>

          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-4 animate-scale-in">
          {links.length > 0 ? (
            links.map((link, index) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <Card className="glass-card hover:shadow-elegant transition-all duration-300 hover:scale-105 border-2 hover:border-primary/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {link.icon && (
                          <span className="text-2xl">{link.icon}</span>
                        )}
                        <span className="font-medium">{link.title}</span>
                      </div>
                      <ExternalLink className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))
          ) : (
            <Card className="glass-card border-2">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No links added yet.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-border/50">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span className="text-sm">Powered by Prism Link Spot</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
