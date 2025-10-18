import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Zap, Video, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  layout_style: string | null;
  profile_theme: string | null;
  background_url: string | null;
  background_type: string | null;
};

type Link = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  order_index: number;
  image_url: string | null;
};

type Media = {
  id: string;
  type: "image" | "video";
  url: string;
  title: string;
  description: string | null;
};

const Profile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;

      // Security: Only select safe columns, exclude user_id to prevent UUID exposure
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, theme_color, layout_style, profile_theme, background_url, background_type, created_at, updated_at")
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

      const { data: mediaData } = await supabase
        .from("media")
        .select("*")
        .eq("profile_id", profileData.id)
        .order("order_index");

      if (mediaData) {
        setMedia(mediaData as Media[]);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [username]);

  const openLightbox = (url: string, type: "image" | "video") => {
    setLightboxUrl(url);
    setLightboxType(type);
  };

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
        <div className="text-center animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Profile Not Found</h1>
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
  const layoutStyle = profile.layout_style || "list";
  const profileTheme = profile.profile_theme || "default";
  const profileUrl = `${window.location.origin}/u/${profile.username}`;

  // Theme backgrounds
  const getThemeBackground = () => {
    if (profile.background_url && profile.background_type === "image") {
      return {
        backgroundImage: `url(${profile.background_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      };
    }

    switch (profileTheme) {
      case "dark":
        return { backgroundColor: "hsl(240 10% 3.9%)" };
      case "light":
        return { backgroundColor: "hsl(0 0% 100%)" };
      case "gradient":
        return { background: "linear-gradient(135deg, hsl(330 100% 70%), hsl(280 100% 75%), hsl(240 100% 70%))" };
      case "minimal":
        return { background: "linear-gradient(135deg, hsl(220 10% 95%), hsl(220 10% 98%))" };
      default:
        return {};
    }
  };

  const getTextColor = () => {
    if (profileTheme === "dark" || profileTheme === "gradient") return "text-white";
    if (profileTheme === "light" || profileTheme === "minimal") return "text-gray-900";
    return "";
  };

  const getCardStyle = () => {
    if (profileTheme === "dark") return "bg-gray-800/80 border-gray-700";
    if (profileTheme === "light") return "bg-white/80 border-gray-200";
    if (profileTheme === "minimal") return "bg-white/90 border-gray-300";
    return "glass-card border-2";
  };

  // Render links based on layout
  const renderLinks = () => {
    if (links.length === 0) {
      return (
        <Card className={`${getCardStyle()} animate-fade-in`}>
          <CardContent className="p-8 text-center">
            <p className={`${getTextColor()} opacity-60`}>No links added yet.</p>
          </CardContent>
        </Card>
      );
    }

    if (layoutStyle === "grid") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link, index) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block animate-scale-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <Card className={`${getCardStyle()} hover:shadow-elegant transition-all duration-300 hover:scale-105 hover-lift`}>
                <CardContent className="p-4">
                  {link.image_url && (
                    <img 
                      src={link.image_url} 
                      alt={link.title} 
                      className="w-full h-40 object-cover rounded mb-3"
                      loading="lazy"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    {link.icon && !link.image_url && <span className="text-2xl">{link.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${getTextColor()} block truncate`}>{link.title}</span>
                    </div>
                    <ExternalLink className="w-5 h-5 opacity-50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      );
    }

    if (layoutStyle === "card") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link, index) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block animate-bounce-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <Card className={`${getCardStyle()} hover:shadow-elegant transition-all duration-300 hover:scale-105 hover-lift h-full`}>
                <CardContent className="p-6 text-center">
                  {link.image_url ? (
                    <img 
                      src={link.image_url} 
                      alt={link.title} 
                      className="w-full h-40 object-cover rounded mb-3"
                      loading="lazy"
                    />
                  ) : link.icon ? (
                    <div className="text-4xl mb-3">{link.icon}</div>
                  ) : null}
                  <span className={`font-medium ${getTextColor()} block`}>{link.title}</span>
                  <ExternalLink className="w-4 h-4 mx-auto mt-2 opacity-50" />
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      );
    }

    // Default list layout
    return (
      <div className="space-y-4">
        {links.map((link, index) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block animate-slide-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <Card className={`${getCardStyle()} hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] hover-lift`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {link.image_url && (
                    <img 
                      src={link.image_url} 
                      alt={link.title} 
                      className="w-20 h-20 object-cover rounded flex-shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {link.icon && !link.image_url && <span className="text-2xl flex-shrink-0">{link.icon}</span>}
                      <span className={`font-medium ${getTextColor()} truncate`}>{link.title}</span>
                    </div>
                    <ExternalLink className="w-5 h-5 opacity-50 ml-2 flex-shrink-0" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    );
  };

  // Render media gallery
  const renderMedia = () => {
    if (media.length === 0) return null;

    const gridClass = layoutStyle === "list" 
      ? "grid-cols-2 md:grid-cols-3" 
      : layoutStyle === "card"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3";

    return (
      <div className="mt-12 animate-fade-up">
        <h2 className={`text-2xl md:text-3xl font-bold text-center mb-6 ${getTextColor()}`}>
          Media Gallery
        </h2>
        <div className={`grid ${gridClass} gap-3 md:gap-4`}>
          {media.map((item, index) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:scale-105 transition-all duration-300 hover:shadow-elegant animate-scale-in"
              onClick={() => openLightbox(item.url, item.type)}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="w-8 md:w-12 h-8 md:h-12 text-white" />
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                  <p className="text-white text-xs md:text-sm font-medium truncate">
                    {item.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative" style={getThemeBackground()}>
      {/* Overlay for better text readability on image backgrounds */}
      {profile.background_url && profile.background_type === "image" && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      )}
      
      <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Profile Header */}
        <div className="text-center mb-8 md:mb-12 animate-fade-in">
          <Avatar 
            className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 border-4 shadow-elegant hover:scale-110 transition-transform" 
            style={{ borderColor: themeColor }}
          >
            <AvatarImage src={profile.avatar_url || ""} alt={profile.display_name || profile.username} />
            <AvatarFallback className="text-2xl md:text-3xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h1 className={`text-2xl md:text-4xl font-bold mb-2 ${getTextColor()}`}>
            {profile.display_name || profile.username}
          </h1>
          <p className={`${getTextColor()} opacity-70 mb-4`}>@{profile.username}</p>

          {profile.bio && (
            <p className={`text-sm md:text-base ${getTextColor()} opacity-80 max-w-md mx-auto mb-4`}>
              {profile.bio}
            </p>
          )}

          {/* QR Code Button */}
          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQR(true)}
              className="gap-2 hover-scale"
              style={{ 
                borderColor: themeColor,
                color: profileTheme === "dark" || profileTheme === "gradient" ? "white" : "inherit"
              }}
            >
              <QrCode className="w-4 h-4" />
              Show QR Code
            </Button>
          </div>
        </div>

        {/* Links Section */}
        <div className="mb-8 md:mb-12">
          {renderLinks()}
        </div>

        {/* Media Gallery */}
        {renderMedia()}

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-white/20">
          <div className={`flex items-center justify-center gap-2 ${getTextColor()} opacity-60`}>
            <Zap className="w-4 h-4" />
            <span className="text-sm">Powered by Prism Link Spot</span>
          </div>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code for {profile.display_name || profile.username}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG
                value={profileUrl}
                size={200}
                level="H"
                includeMargin={true}
                fgColor={themeColor}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to visit this profile
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {media.find(m => m.url === lightboxUrl)?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            {lightboxType === "image" ? (
              <img
                src={lightboxUrl || ""}
                alt="Preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={lightboxUrl || ""}
                controls
                className="w-full h-auto max-h-[70vh] rounded-lg"
                autoPlay
              />
            )}
            {media.find(m => m.url === lightboxUrl)?.description && (
              <p className="mt-4 text-sm text-muted-foreground">
                {media.find(m => m.url === lightboxUrl)?.description}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
