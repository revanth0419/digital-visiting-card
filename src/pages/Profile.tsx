import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, extractStoragePath } from "@/lib/storage";
import { profileViewRateLimiter } from "@/lib/rate-limit";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Zap, Video, QrCode, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  is_shopping_link: boolean;
  price: string | null;
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
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [showQR, setShowQR] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);
  const [signedBackgroundUrl, setSignedBackgroundUrl] = useState<string | null>(null);
  const [signedMediaUrls, setSignedMediaUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>("links");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      // Removed rate limiting for better user experience during development

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

      // Generate signed URLs for avatar and background with longer expiry
      if (profileData.avatar_url) {
        const path = extractStoragePath(profileData.avatar_url) || profileData.avatar_url;
        const signedUrl = await getSignedUrl('avatars', path, 7200); // 2 hours
        if (signedUrl) setSignedAvatarUrl(signedUrl);
      } else {
        setSignedAvatarUrl(null);
      }

      if (profileData.background_url && profileData.background_type === 'image') {
        const path = extractStoragePath(profileData.background_url) || profileData.background_url;
        const signedUrl = await getSignedUrl('media', path, 7200); // 2 hours
        if (signedUrl) setSignedBackgroundUrl(signedUrl);
      } else {
        setSignedBackgroundUrl(null);
      }

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
        
        // Generate signed URLs for all media with longer expiry
        const urls: Record<string, string> = {};
        for (const item of mediaData) {
          const path = extractStoragePath(item.url) || item.url;
          const signedUrl = await getSignedUrl('media', path, 7200); // 2 hours
          if (signedUrl) {
            urls[item.id] = signedUrl;
          }
        }
        setSignedMediaUrls(urls);
      }

      setLoading(false);
    };

    fetchProfile();

    // Setup realtime subscriptions for live updates
    if (!username) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `username=eq.${username}`,
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new as Profile;
            const oldProfile = payload.old as Profile;
            setProfile(updatedProfile);
            
            // Only regenerate signed URLs if the URLs actually changed
            if (updatedProfile.avatar_url !== oldProfile.avatar_url) {
              if (updatedProfile.avatar_url) {
                const path = extractStoragePath(updatedProfile.avatar_url) || updatedProfile.avatar_url;
                const signedUrl = await getSignedUrl('avatars', path, 7200); // 2 hours
                if (signedUrl) setSignedAvatarUrl(signedUrl);
              } else {
                setSignedAvatarUrl(null);
              }
            }

            if (updatedProfile.background_url !== oldProfile.background_url || 
                updatedProfile.background_type !== oldProfile.background_type) {
              if (updatedProfile.background_url && updatedProfile.background_type === 'image') {
                const path = extractStoragePath(updatedProfile.background_url) || updatedProfile.background_url;
                const signedUrl = await getSignedUrl('media', path, 7200); // 2 hours
                if (signedUrl) setSignedBackgroundUrl(signedUrl);
              } else {
                setSignedBackgroundUrl(null);
              }
            }
          }
        }
      )
      .subscribe();

    // Subscribe to links changes
    const linksChannel = supabase
      .channel('links-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'links',
        },
        async (payload) => {
          if (profile) {
            const { data: linksData } = await supabase
              .from("links")
              .select("*")
              .eq("profile_id", profile.id)
              .eq("is_active", true)
              .order("order_index");

            if (linksData) {
              setLinks(linksData);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to media changes
    const mediaChannel = supabase
      .channel('media-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media',
        },
        async (payload) => {
          if (profile) {
            const { data: mediaData } = await supabase
              .from("media")
              .select("*")
              .eq("profile_id", profile.id)
              .order("order_index");

            if (mediaData) {
              setMedia(mediaData as Media[]);
              
              // Generate signed URLs for all media
              const urls: Record<string, string> = {};
              for (const item of mediaData) {
                const path = extractStoragePath(item.url) || item.url;
                const signedUrl = await getSignedUrl('media', path);
                if (signedUrl) {
                  urls[item.id] = signedUrl;
                }
              }
              setSignedMediaUrls(urls);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(linksChannel);
      supabase.removeChannel(mediaChannel);
    };
  }, [username, toast, profile]);

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
    if (signedBackgroundUrl && profile.background_type === "image") {
      return {
        backgroundImage: `url(${signedBackgroundUrl})`,
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

  // Filter links based on both show_in_links and is_shopping_link
  const linksTabItems = links.filter(link => (link as any).show_in_links);
  const shopTabItems = links.filter(link => link.is_shopping_link);

  // Render empty state for shop section
  const renderShopEmptyState = () => (
    <div className="text-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-6xl mb-4">🛒</div>
        <h3 className={`text-xl font-semibold mb-2 ${getTextColor()}`}>No products yet</h3>
        <p className={`text-sm ${getTextColor()} opacity-60`}>Add your first product link to get started!</p>
      </motion.div>
    </div>
  );

  // Render a section of links (either regular or shopping)
  const renderLinkSection = (sectionLinks: Link[], sectionTitle: string) => {
    const isShoppingSection = sectionTitle === "Shop";
    const displayedLinks = isShoppingSection && !showAllProducts 
      ? sectionLinks.slice(0, 3) 
      : sectionLinks;
    const hasMoreProducts = isShoppingSection && sectionLinks.length > 3;

    if (layoutStyle === "grid") {
      return (
        <div className="mb-8">
          {!isShoppingSection && (
            <h3 className={`text-xl font-semibold mb-6 ${getTextColor()}`}>{sectionTitle}</h3>
          )}
          <div className={`grid gap-4 ${isShoppingSection ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            <AnimatePresence>
              {displayedLinks.map((link, index) => (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className={`${getCardStyle()} overflow-hidden relative transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    isShoppingSection && link.image_url ? 'bg-gradient-to-br from-primary/5 via-transparent to-accent/5' : ''
                  }`}>
                    <CardContent className="p-0">
                      {link.image_url ? (
                        <div className="relative overflow-hidden h-48">
                          <img 
                            src={link.image_url} 
                            alt={link.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          {isShoppingSection && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="absolute bottom-3 left-3 right-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                  <ExternalLink className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {link.icon && !link.image_url && <span className="text-2xl mb-2 block">{link.icon}</span>}
                            <h4 className={`font-semibold ${getTextColor()} mb-1 line-clamp-2 text-sm`}>{link.title}</h4>
                            {link.price && (
                              <p className="text-lg font-bold text-primary mt-2">{link.price}</p>
                            )}
                          </div>
                          {!link.image_url && (
                            <ExternalLink className="w-4 h-4 opacity-50 flex-shrink-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
          {hasMoreProducts && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={() => setShowAllProducts(!showAllProducts)}
                variant="outline"
                className="group"
              >
                {showAllProducts ? "Show Less" : `View All Products (${sectionLinks.length})`}
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAllProducts ? "rotate-180" : ""}`} />
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (layoutStyle === "card") {
      return (
        <div className="mb-8">
          {!isShoppingSection && (
            <h3 className={`text-xl font-semibold mb-6 ${getTextColor()}`}>{sectionTitle}</h3>
          )}
          <div className={`grid gap-4 ${isShoppingSection ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            <AnimatePresence>
              {displayedLinks.map((link, index) => (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className={`${getCardStyle()} overflow-hidden relative transition-all duration-300 hover:scale-105 hover:shadow-xl h-full ${
                    isShoppingSection && link.image_url ? 'bg-gradient-to-br from-primary/5 via-transparent to-accent/5' : ''
                  }`}>
                    <CardContent className="p-0 flex flex-col h-full">
                      {link.image_url ? (
                        <div className="relative overflow-hidden h-48">
                          <img 
                            src={link.image_url} 
                            alt={link.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          {isShoppingSection && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="absolute bottom-3 right-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                  <ExternalLink className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : link.icon ? (
                        <div className="text-4xl pt-6 text-center">{link.icon}</div>
                      ) : null}
                      <div className="p-4 text-center flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className={`font-semibold ${getTextColor()} mb-2 line-clamp-2 text-sm`}>{link.title}</h4>
                          {link.price && (
                            <p className="text-lg font-bold text-primary mt-2">{link.price}</p>
                          )}
                        </div>
                        {!link.image_url && (
                          <ExternalLink className="w-4 h-4 mx-auto mt-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
          {hasMoreProducts && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={() => setShowAllProducts(!showAllProducts)}
                variant="outline"
                className="group"
              >
                {showAllProducts ? "Show Less" : `View All Products (${sectionLinks.length})`}
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAllProducts ? "rotate-180" : ""}`} />
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Default list layout
    return (
      <div className="mb-8">
        {!isShoppingSection && (
          <h3 className={`text-xl font-semibold mb-6 ${getTextColor()}`}>{sectionTitle}</h3>
        )}
        <div className="space-y-4">
          <AnimatePresence>
            {displayedLinks.map((link, index) => (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className={`${getCardStyle()} overflow-hidden relative transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                  isShoppingSection && link.image_url ? 'bg-gradient-to-r from-primary/5 via-transparent to-accent/5' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {link.image_url && (
                        <div className="relative overflow-hidden rounded flex-shrink-0 h-20 w-20">
                          <img 
                            src={link.image_url} 
                            alt={link.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          {isShoppingSection && (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <ExternalLink className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            {link.icon && !link.image_url && <span className="text-2xl flex-shrink-0">{link.icon}</span>}
                            <span className={`font-semibold ${getTextColor()} line-clamp-2 text-sm`}>{link.title}</span>
                          </div>
                          {link.price && (
                            <span className="text-lg font-bold text-primary">{link.price}</span>
                          )}
                        </div>
                        {!link.image_url && (
                          <ExternalLink className="w-5 h-5 opacity-50 group-hover:opacity-100 ml-2 flex-shrink-0 transition-opacity" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
        {hasMoreProducts && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setShowAllProducts(!showAllProducts)}
              variant="outline"
              className="group"
            >
              {showAllProducts ? "Show Less" : `View All Products (${sectionLinks.length})`}
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAllProducts ? "rotate-180" : ""}`} />
            </Button>
          </div>
        )}
      </div>
    );
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

    return (
      <div>
        {linksTabItems.length > 0 && renderLinkSection(linksTabItems, "Links")}
        {shopTabItems.length > 0 && renderLinkSection(shopTabItems, "Shop")}
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
          <AnimatePresence>
            {media.map((item, index) => {
              const mediaUrl = signedMediaUrls[item.id] || item.url;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer transition-all duration-300 hover:shadow-elegant"
                  onClick={() => openLightbox(mediaUrl, item.type)}
                  whileHover={{ scale: 1.05 }}
                >
                  {item.type === "image" ? (
                    <img
                      src={mediaUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div
                          whileHover={{ scale: 1.2 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <Video className="w-8 md:w-12 h-8 md:h-12 text-white drop-shadow-glow" />
                        </motion.div>
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
                </motion.div>
              );
            })}
          </AnimatePresence>
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
            <AvatarImage src={signedAvatarUrl || profile.avatar_url || ""} alt={profile.display_name || profile.username} />
            <AvatarFallback className="text-2xl md:text-3xl" style={{ backgroundColor: themeColor + "20", color: themeColor }}>
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h1 className={`text-2xl md:text-4xl font-bold mb-2 ${getTextColor()}`}>
            {profile.display_name || profile.username}
          </h1>
          <p className={`${getTextColor()} opacity-70 mb-4`}>@{profile.username}</p>

          {profile.bio && (
            <p className={`text-sm md:text-base ${getTextColor()} opacity-80 max-w-md mx-auto mb-6`}>
              {profile.bio}
            </p>
          )}


          {/* QR Code Button */}
          <motion.div 
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQR(true)}
              className="gap-2 transition-all duration-300"
              style={{ 
                borderColor: themeColor,
                color: profileTheme === "dark" || profileTheme === "gradient" ? "white" : themeColor,
                backgroundColor: profileTheme === "dark" || profileTheme === "gradient" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                boxShadow: `0 0 20px ${themeColor}00`
              }}
            >
              <QrCode className="w-4 h-4" />
              <span className="font-medium">Show QR Code</span>
            </Button>
          </motion.div>
        </div>

        {/* Tabs for Links and Shop */}
        <div className="mb-8 md:mb-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full max-w-md mx-auto grid-cols-2 mb-8 ${
              profileTheme === "dark" || profileTheme === "gradient" 
                ? "bg-white/10 text-white" 
                : "bg-gray-900 text-white"
            }`}>
              <TabsTrigger 
                value="links"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Links
              </TabsTrigger>
              <TabsTrigger 
                value="shop"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Shop
              </TabsTrigger>
            </TabsList>

            {/* Links Tab - Shows links where show_in_links is true */}
            <TabsContent value="links" className="animate-fade-in">
              {linksTabItems.length > 0 ? (
                <div className="space-y-8">
                  {linksTabItems.filter(link => !link.is_shopping_link).length > 0 && (
                    <div>
                      <h3 className={`text-xl font-semibold mb-4 ${getTextColor()}`}>My Links</h3>
                      {renderLinkSection(linksTabItems.filter(link => !link.is_shopping_link), "Links")}
                    </div>
                  )}
                  {linksTabItems.filter(link => link.is_shopping_link).length > 0 && (
                    <div>
                      <h3 className={`text-xl font-semibold mb-4 ${getTextColor()}`}>Featured Products</h3>
                      {renderLinkSection(linksTabItems.filter(link => link.is_shopping_link), "Shop")}
                    </div>
                  )}
                </div>
              ) : (
                <Card className={`${getCardStyle()} animate-fade-in`}>
                  <CardContent className="p-8 text-center">
                    <p className={`${getTextColor()} opacity-60`}>No links added yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Shop Tab - Shows only shopping links */}
            <TabsContent value="shop" className="animate-fade-in">
              {shopTabItems.length > 0 ? (
                renderLinkSection(shopTabItems, "Shop")
              ) : (
                renderShopEmptyState()
              )}
            </TabsContent>
          </Tabs>
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

      {/* Lightbox Dialog with Framer Motion */}
      <AnimatePresence>
        {lightboxUrl && (
          <Dialog open={true} onOpenChange={() => setLightboxUrl(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative"
              >
                <DialogHeader className="p-4 pb-2">
                  <DialogTitle className="text-white">
                    {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="relative p-4">
                  {lightboxType === "image" ? (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      src={lightboxUrl}
                      alt="Preview"
                      className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
                    />
                  ) : (
                    <motion.video
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      src={lightboxUrl}
                      controls
                      controlsList="nodownload"
                      className="w-full h-auto max-h-[75vh] rounded-lg"
                      autoPlay
                      playsInline
                    />
                  )}
                  {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.description && (
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-4 text-sm text-gray-300"
                    >
                      {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.description}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
