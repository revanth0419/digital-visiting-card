import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadRateLimiter } from "@/lib/rate-limit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Save, LayoutList, LayoutGrid, Rows3, Palette, Image } from "lucide-react";
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

  // New fields
  const [designation, setDesignation] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");

  const [signedAvatarUrl, setSignedAvatarUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const getSignedUrl = async (bucket: string, path: string) => {
    if (!path) return "";
    try {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || "";
    } catch {
      return "";
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Profile might be creating in background by trigger
        console.log("Profile not found immediately, retrying or waiting...");
        return;
      }

      if (data) {
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

        // Set new fields
        setDesignation(data.designation || "");
        setCompany(data.company || "");
        setLocation(data.location || "");
        setWebsite(data.website || "");
        setPublicPhone(data.public_phone || "");
        setPublicEmail(data.public_email || "");

        // Get signed URL for avatar
        if (data.avatar_url) {
          const signedUrl = await getSignedUrl("avatars", data.avatar_url);
          setSignedAvatarUrl(signedUrl);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch profile:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const { allowed, retryAfter } = uploadRateLimiter.checkLimit();
      if (!allowed) {
        toast({
          title: "Upload limit reached",
          description: `Please wait ${retryAfter} seconds before uploading again.`,
          variant: "destructive",
        });
        return;
      }

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
      uploadRateLimiter.recordAttempt();

      // Delete old avatar if exists
      if (avatarUrl) {
        await supabase.storage.from('avatars').remove([avatarUrl]);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update profile with new avatar path
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(filePath);
      const signedUrl = await getSignedUrl("avatars", filePath);
      setSignedAvatarUrl(signedUrl);

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

      const { allowed, retryAfter } = uploadRateLimiter.checkLimit();
      if (!allowed) {
        toast({
          title: "Upload limit reached",
          description: `Please wait ${retryAfter} seconds before uploading again.`,
          variant: "destructive",
        });
        return;
      }

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
      uploadRateLimiter.recordAttempt();

      if (backgroundUrl) {
        await supabase.storage.from('media').remove([backgroundUrl]);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `bg_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setBackgroundUrl(filePath);
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

    // Validate username
    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
      toast({
        title: "Invalid username",
        description: "Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username, // Added username update
          display_name: displayName,
          bio,
          theme_color: themeColor,
          layout_style: layoutStyle,
          profile_theme: profileTheme,
          background_url: backgroundUrl,
          background_type: backgroundType,
          designation,
          company,
          location,
          website,
          public_phone: publicPhone,
          public_email: publicEmail,
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Profile updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
                <AvatarImage src={signedAvatarUrl || avatarUrl} alt={displayName || username} />
                <AvatarFallback className="text-2xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
                  {(displayName || username || "U").charAt(0).toUpperCase()}
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
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className="bg-background"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Product Designer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-3">Contact Information (Public)</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publicPhone">Public Phone</Label>
                    <Input
                      id="publicPhone"
                      value={publicPhone}
                      onChange={(e) => setPublicPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="publicEmail">Public Email</Label>
                    <Input
                      id="publicEmail"
                      value={publicEmail}
                      onChange={(e) => setPublicEmail(e.target.value)}
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>
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
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${layoutStyle === "list" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <LayoutList className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">List</p>
                </button>
                <button
                  onClick={() => setLayoutStyle("grid")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${layoutStyle === "grid" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <LayoutGrid className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Grid</p>
                </button>
                <button
                  onClick={() => setLayoutStyle("compact")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${layoutStyle === "compact" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <Rows3 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Compact</p>
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
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${profileTheme === "default" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <div className="h-12 rounded bg-gradient-to-br from-purple-500 to-blue-600 mb-2"></div>
                  <p className="text-sm font-medium">Default</p>
                </button>
                <button
                  onClick={() => setProfileTheme("light")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${profileTheme === "light" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <div className="h-12 rounded bg-white border-2 mb-2"></div>
                  <p className="text-sm font-medium">Light</p>
                </button>
                <button
                  onClick={() => setProfileTheme("dark")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${profileTheme === "dark" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <div className="h-12 rounded bg-gray-900 mb-2"></div>
                  <p className="text-sm font-medium">Dark</p>
                </button>
                <button
                  onClick={() => setProfileTheme("gradient")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${profileTheme === "gradient" ? "border-primary bg-primary/10" : "border-border"
                    }`}
                >
                  <div className="h-12 rounded bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 mb-2"></div>
                  <p className="text-sm font-medium">Vibrant</p>
                </button>
                <button
                  onClick={() => setProfileTheme("minimal")}
                  className={`p-4 border-2 rounded-lg transition-all hover:border-primary ${profileTheme === "minimal" ? "border-primary bg-primary/10" : "border-border"
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
                Upload a custom background image
              </p>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => bgInputRef.current?.click()}
                disabled={uploadingBg}
              >
                {uploadingBg ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Background
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">Max 10MB (JPG, PNG, WEBP)</p>
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
