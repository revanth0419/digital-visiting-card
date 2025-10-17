import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Save, LayoutList, LayoutGrid, PanelsTopLeft, Palette, Image } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileEditorProps = {
  userId: string;
};

const ProfileEditor = ({ userId }: ProfileEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#8b5cf6");
  const [layoutStyle, setLayoutStyle] = useState("list");
  const [profileTheme, setProfileTheme] = useState("default");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundType, setBackgroundType] = useState("gradient");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
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
      setLayoutStyle(data.layout_style || "list");
      setProfileTheme(data.profile_theme || "default");
      setBackgroundUrl(data.background_url || "");
      setBackgroundType(data.background_type || "gradient");
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: "Please upload an image file (JPG, PNG, or WEBP)",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5242880) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${userId}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "Success",
        description: "Avatar uploaded successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading avatar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: "Please upload an image file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10485760) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setUploadingBg(true);

      if (backgroundUrl) {
        const oldPath = backgroundUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('media')
            .remove([`${userId}/backgrounds/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `bg_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setBackgroundUrl(publicUrl);
      setBackgroundType("image");
      
      toast({
        title: "Success",
        description: "Background uploaded! Click Save to apply.",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading background",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingBg(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        theme_color: themeColor,
        layout_style: layoutStyle,
        profile_theme: profileTheme,
        background_url: backgroundUrl,
        background_type: backgroundType,
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
    <Card className="glass-card border-2 animate-fade-in">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Customize your public profile</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-24 h-24 border-4" style={{ borderColor: themeColor }}>
                <AvatarImage src={avatarUrl} alt={displayName || username} />
                <AvatarFallback className="text-2xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
                  {(displayName || username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Avatar
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 5MB (JPG, PNG, WEBP)
                </p>
              </div>
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
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <div className="space-y-2">
              <Label>Profile Layout</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose how your links and media are displayed
              </p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setLayoutStyle("list")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    layoutStyle === "list" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <LayoutList className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">List</p>
                </button>
                <button
                  onClick={() => setLayoutStyle("grid")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    layoutStyle === "grid" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <LayoutGrid className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Grid</p>
                </button>
                <button
                  onClick={() => setLayoutStyle("card")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    layoutStyle === "card" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <PanelsTopLeft className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Card</p>
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Profile Theme
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select a theme for your profile page
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setProfileTheme("default")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    profileTheme === "default" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="h-12 rounded bg-gradient-to-br from-purple-500 to-blue-600 mb-2"></div>
                  <p className="text-sm font-medium">Default</p>
                </button>
                <button
                  onClick={() => setProfileTheme("light")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    profileTheme === "light" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="h-12 rounded bg-white border-2 mb-2"></div>
                  <p className="text-sm font-medium">Light</p>
                </button>
                <button
                  onClick={() => setProfileTheme("dark")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    profileTheme === "dark" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="h-12 rounded bg-gray-900 mb-2"></div>
                  <p className="text-sm font-medium">Dark</p>
                </button>
                <button
                  onClick={() => setProfileTheme("gradient")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    profileTheme === "gradient" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="h-12 rounded bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 mb-2"></div>
                  <p className="text-sm font-medium">Vibrant</p>
                </button>
                <button
                  onClick={() => setProfileTheme("minimal")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${
                    profileTheme === "minimal" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="h-12 rounded bg-gradient-to-br from-gray-100 to-gray-200 border mb-2"></div>
                  <p className="text-sm font-medium">Minimal</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Custom Background
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Upload a custom background image for your profile
              </p>
              
              {backgroundUrl && backgroundType === "image" && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 mb-2">
                  <img src={backgroundUrl} alt="Background preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={uploadingBg}
                  className="flex-1"
                >
                  {uploadingBg ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </Button>
                {backgroundUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBackgroundUrl("");
                      setBackgroundType("gradient");
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Max 10MB • Will replace theme background
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleSave}
          disabled={saving}
          variant="gradient"
          className="w-full mt-6"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileEditor;
