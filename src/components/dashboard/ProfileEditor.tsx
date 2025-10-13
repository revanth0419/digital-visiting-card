import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

type ProfileEditorProps = {
  userId: string;
};

const ProfileEditor = ({ userId }: ProfileEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#8b5cf6");
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load profile.",
        variant: "destructive",
      });
    } else if (data) {
      setProfileId(data.id);
      setUsername(data.username || "");
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
      setThemeColor(data.theme_color || "#8b5cf6");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        theme_color: themeColor,
      })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "Profile updated successfully.",
      });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="glass-card border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-2">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Customize your public profile</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <Avatar className="w-24 h-24 border-4" style={{ borderColor: themeColor }}>
            <AvatarImage src={avatarUrl} alt={displayName || username} />
            <AvatarFallback className="text-2xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
              {(displayName || username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" disabled>
            <Upload className="w-4 h-4 mr-2" />
            Upload Avatar (Coming Soon)
          </Button>
        </div>

        {/* Username (Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Your profile URL: /u/{username}
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">
            {bio.length}/200
          </p>
        </div>

        {/* Theme Color */}
        <div className="space-y-2">
          <Label htmlFor="themeColor">Theme Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="themeColor"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-16 h-10 rounded-md border-2 cursor-pointer"
            />
            <Input
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              placeholder="#8b5cf6"
              maxLength={7}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileEditor;
