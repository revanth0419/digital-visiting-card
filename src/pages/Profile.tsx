import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, extractStoragePath } from "@/lib/storage";
import { profileViewRateLimiter } from "@/lib/rate-limit";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Zap, Video, QrCode, ChevronDown, Link2, ShoppingBag, Image as ImageIcon, UserPlus, UserCheck, BookOpen, Music4 } from "lucide-react";
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
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  layout_style: string | null;
  profile_theme: string | null;
  background_url: string | null;
  background_type: string | null;
  user_id?: string;
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

type MusicTrack = {
  id: string;
  title: string;
  genre: string | null;
  mood: string | null;
  has_vocals: boolean;
  audio_url: string | null;
  cover_image_url: string | null;
  created_at: string;
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
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Use public_profiles view to avoid exposing user_id
      const { data: profileData, error: profileError } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError || !profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Get user_id for the profile owner (needed for books and subscriptions)
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", profileData.id)
        .single();

      // Fetch books and music for this profile (only show_on_profile = true for public view)
      if (ownerData?.user_id) {
        const { data: booksData } = await supabase
          .from("books")
          .select("*")
          .eq("user_id", ownerData.user_id)
          .eq("show_on_profile", true)
          .order("created_at", { ascending: false });
        if (booksData) setBooks(booksData);

        const { data: musicData } = await supabase
          .from("music_tracks")
          .select("*")
          .eq("user_id", ownerData.user_id)
          .eq("show_on_profile", true)
          .order("created_at", { ascending: false });
        if (musicData) setMusicTracks(musicData as MusicTrack[]);
      }

      // For subscriptions, we need to check if viewing someone else's profile
      if (user && ownerData?.user_id && ownerData.user_id !== user.id) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", user.id)
          .eq("subscribed_to_id", ownerData.user_id)
          .maybeSingle();
        setIsSubscribed(!!subscription);
      }

      // Generate signed URLs for avatar and background with longer expiry
      if (profileData.avatar_url) {
        const path = extractStoragePath(profileData.avatar_url) || profileData.avatar_url;
        const signedUrl = await getSignedUrl('avatars', path, 7200);
        if (signedUrl) setSignedAvatarUrl(signedUrl);
      } else {
        setSignedAvatarUrl(null);
      }

      if (profileData.background_url && profileData.background_type === 'image') {
        const path = extractStoragePath(profileData.background_url) || profileData.background_url;
        const signedUrl = await getSignedUrl('media', path, 7200);
        if (signedUrl) setSignedBackgroundUrl(signedUrl);
      } else {
        setSignedBackgroundUrl(null);
      }

      const { data: linksData } = await supabase
        .from("links")
        .select("*")
        .eq("profile_id", profileData.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (linksData) {
        setLinks(linksData);
      }

      const { data: mediaData } = await supabase
        .from("media")
        .select("*")
        .eq("profile_id", profileData.id)
        .order("order_index", { ascending: true });

      if (mediaData) {
        setMedia(mediaData as Media[]);
        
        const urls: Record<string, string> = {};
        for (const item of mediaData) {
          const path = extractStoragePath(item.url) || item.url;
          const signedUrl = await getSignedUrl('media', path, 7200);
          if (signedUrl) {
            urls[item.id] = signedUrl;
          }
        }
        setSignedMediaUrls(urls);
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
    <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-16 text-center border border-white/20">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <motion.div
          animate={{ 
            rotate: [0, -10, 10, -10, 0],
            scale: [1, 1.1, 1.1, 1.1, 1]
          }}
          transition={{ 
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.2, 0.4, 0.6, 1],
            repeat: Infinity,
            repeatDelay: 3
          }}
          className="text-8xl mb-6 inline-block"
        >
          🛒
        </motion.div>
        <h3 className={`text-2xl font-bold mb-3 ${getTextColor()}`}>No products yet</h3>
        <p className={`text-base ${getTextColor()} opacity-70 max-w-md mx-auto`}>
          Add your first product link to start showcasing your items!
        </p>
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
          <div className={`grid gap-6 ${isShoppingSection ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            <AnimatePresence>
              {displayedLinks.map((link, index) => (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.95 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: index * 0.08,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                >
                  <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 relative group">
                    {/* Gradient Border Effect on Hover */}
                    <div 
                      className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}80, transparent)`,
                        filter: "blur(20px)",
                        transform: "scale(1.05)"
                      }}
                    />
                    
                    <CardContent className="p-0">
                      {link.image_url ? (
                        <div className="relative overflow-hidden aspect-video">
                          <img 
                            src={link.image_url} 
                            alt={link.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                          {/* Overlay with gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-4 left-4">
                              <div 
                                className="w-12 h-12 rounded-2xl backdrop-blur-sm flex items-center justify-center"
                                style={{ backgroundColor: `${themeColor}40` }}
                              >
                                <ExternalLink className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {link.icon && !link.image_url && (
                              <span className="text-3xl mb-3 block">{link.icon}</span>
                            )}
                            <h4 className={`font-bold text-lg ${getTextColor()} mb-2 line-clamp-2`}>
                              {link.title}
                            </h4>
                            {link.price && (
                              <p 
                                className="text-2xl font-bold mt-3"
                                style={{ color: themeColor }}
                              >
                                {link.price}
                              </p>
                            )}
                          </div>
                          {!link.image_url && (
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all duration-300"
                              style={{ backgroundColor: `${themeColor}20` }}
                            >
                              <ExternalLink className="w-5 h-5" style={{ color: themeColor }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
          {hasMoreProducts && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mt-8"
            >
              <Button
                onClick={() => setShowAllProducts(!showAllProducts)}
                size="lg"
                className="rounded-2xl px-6 group"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  color: "white"
                }}
              >
                {showAllProducts ? "Show Less" : `View All Products (${sectionLinks.length})`}
                <ChevronDown className={`ml-2 h-5 w-5 transition-transform duration-300 ${showAllProducts ? "rotate-180" : ""}`} />
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    if (layoutStyle === "compact") {
      return (
        <div className="mb-8">
          <div className="space-y-3">
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
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  whileHover={{ x: 6, transition: { duration: 0.15 } }}
                >
                  <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-2xl overflow-hidden border border-white/20 shadow-md hover:shadow-xl transition-all duration-200 relative">
                    <div 
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10"
                      style={{
                        background: `linear-gradient(90deg, ${themeColor}30, transparent)`,
                        filter: "blur(10px)"
                      }}
                    />
                    
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {link.image_url ? (
                          <div className="relative overflow-hidden rounded-xl flex-shrink-0 h-14 w-14">
                            <img 
                              src={link.image_url} 
                              alt={link.title} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                          </div>
                        ) : link.icon ? (
                          <div 
                            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${themeColor}20` }}
                          >
                            <span className="text-2xl">{link.icon}</span>
                          </div>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold ${getTextColor()} truncate text-base`}>
                            {link.title}
                          </h4>
                          {link.price && (
                            <p className="text-base font-bold mt-1" style={{ color: themeColor }}>
                              {link.price}
                            </p>
                          )}
                        </div>
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 opacity-40 group-hover:opacity-100 transition-all duration-200"
                          style={{ backgroundColor: `${themeColor}20` }}
                        >
                          <ExternalLink className="w-4 h-4" style={{ color: themeColor }} />
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
          {hasMoreProducts && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mt-6"
            >
              <Button
                onClick={() => setShowAllProducts(!showAllProducts)}
                size="lg"
                className="rounded-2xl px-6"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  color: "white"
                }}
              >
                {showAllProducts ? "Show Less" : `View All (${sectionLinks.length})`}
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${showAllProducts ? "rotate-180" : ""}`} />
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    // Default list layout
    return (
      <div className="mb-8">
        <div className="space-y-4">
          <AnimatePresence>
            {displayedLinks.map((link, index) => (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
                whileHover={{ x: 8, transition: { duration: 0.2 } }}
              >
                <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl overflow-hidden border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-300 relative">
                  {/* Gradient glow on hover */}
                  <div 
                    className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                    style={{
                      background: `linear-gradient(90deg, ${themeColor}40, transparent)`,
                      filter: "blur(15px)"
                    }}
                  />
                  
                  <CardContent className="p-5">
                    <div className="flex items-center gap-5">
                      {link.image_url && (
                        <div className="relative overflow-hidden rounded-2xl flex-shrink-0 h-24 w-24">
                          <img 
                            src={link.image_url} 
                            alt={link.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div 
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${themeColor}60, ${themeColor}30)` }}
                          >
                            <ExternalLink className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            {link.icon && !link.image_url && (
                              <span className="text-3xl flex-shrink-0">{link.icon}</span>
                            )}
                            <span className={`font-bold text-lg ${getTextColor()} line-clamp-2`}>
                              {link.title}
                            </span>
                          </div>
                          {link.price && (
                            <span 
                              className="text-2xl font-bold"
                              style={{ color: themeColor }}
                            >
                              {link.price}
                            </span>
                          )}
                        </div>
                        {!link.image_url && (
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center ml-4 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-all duration-300"
                            style={{ backgroundColor: `${themeColor}20` }}
                          >
                            <ExternalLink className="w-6 h-6" style={{ color: themeColor }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
        {hasMoreProducts && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mt-8"
          >
            <Button
              onClick={() => setShowAllProducts(!showAllProducts)}
              size="lg"
              className="rounded-2xl px-6"
              style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                color: "white"
              }}
            >
              {showAllProducts ? "Show Less" : `View All Products (${sectionLinks.length})`}
              <ChevronDown className={`ml-2 h-5 w-5 transition-transform duration-300 ${showAllProducts ? "rotate-180" : ""}`} />
            </Button>
          </motion.div>
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

  // Render media gallery with Masonry-style layout
  const renderMedia = () => {
    if (media.length === 0) return null;

    return (
      <div className="space-y-4">
        {/* Masonry Grid */}
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
          <AnimatePresence>
            {media.map((item, index) => {
              const mediaUrl = signedMediaUrls[item.id] || item.url;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.1,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className="group relative rounded-3xl overflow-hidden cursor-pointer break-inside-avoid mb-4"
                  onClick={() => openLightbox(mediaUrl, item.type)}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                >
                  <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                    {/* Glow effect on hover */}
                    <div 
                      className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}60, transparent)`,
                        filter: "blur(20px)",
                        transform: "scale(1.1)"
                      }}
                    />
                    
                    {item.type === "image" ? (
                      <img
                        src={mediaUrl}
                        alt={item.title}
                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="relative w-full">
                        <video
                          src={mediaUrl}
                          className="w-full h-auto object-cover"
                          preload="metadata"
                        />
                        <div 
                          className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
                          style={{ background: `${themeColor}40` }}
                        >
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                            className="bg-white/20 backdrop-blur-md rounded-full p-6"
                          >
                            <Video className="w-10 h-10 text-white" />
                          </motion.div>
                        </div>
                      </div>
                    )}
                    
                    {/* Overlay with title */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white text-sm font-bold mb-1">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-white/80 text-xs line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
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
    <div className="min-h-screen relative overflow-hidden" style={getThemeBackground()}>
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Overlay for better text readability on image backgrounds */}
      {profile.background_url && profile.background_type === "image" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60 backdrop-blur-sm"></div>
      )}
      
      <div className="relative max-w-5xl mx-auto px-4 py-8 md:py-16">
        {/* Profile Header - Card Style with Glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
            {/* Profile Picture with Gradient Glow */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="relative inline-block mb-6"
            >
              <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-60 animate-pulse"
                style={{ 
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                  transform: "scale(1.1)"
                }}
              />
              <Avatar 
                className="w-32 h-32 md:w-40 md:h-40 relative border-4 border-white/30 shadow-2xl hover:scale-105 transition-all duration-300" 
                style={{ 
                  borderColor: `${themeColor}40`,
                  boxShadow: `0 0 40px ${themeColor}60`
                }}
              >
                <AvatarImage src={signedAvatarUrl || profile.avatar_url || ""} alt={profile.display_name || profile.username} />
                <AvatarFallback className="text-3xl md:text-4xl font-bold" style={{ backgroundColor: themeColor + "30", color: themeColor }}>
                  {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h1 
                className={`text-3xl md:text-5xl font-bold mb-3 ${getTextColor()}`}
                style={{ 
                  textShadow: profileTheme === "dark" || profileTheme === "gradient" 
                    ? "0 2px 20px rgba(0,0,0,0.5)" 
                    : "0 2px 10px rgba(255,255,255,0.3)"
                }}
              >
                {profile.display_name || profile.username}
              </h1>
              <p className={`text-lg ${getTextColor()} opacity-70 mb-4`}>@{profile.username}</p>

              {profile.bio && (
                <p className={`text-base md:text-lg ${getTextColor()} opacity-90 max-w-2xl mx-auto mb-8 leading-relaxed`}>
                  {profile.bio}
                </p>
              )}

              {/* Subscribe Button (only show if viewing someone else's profile and logged in) */}
              {currentUserId && profile.user_id && currentUserId !== profile.user_id && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="mb-4"
                >
                  <Button
                    size="lg"
                    variant={isSubscribed ? "secondary" : "default"}
                    onClick={async () => {
                      try {
                        if (isSubscribed) {
                          const { error } = await supabase
                            .from("subscriptions")
                            .delete()
                            .eq("subscriber_id", currentUserId)
                            .eq("subscribed_to_id", profile.user_id);

                          if (error) throw error;
                          setIsSubscribed(false);
                          toast({
                            title: "Unsubscribed",
                            description: `You will no longer receive updates from ${profile.display_name || profile.username}`,
                          });
                        } else {
                          const { error } = await supabase
                            .from("subscriptions")
                            .insert({
                              subscriber_id: currentUserId,
                              subscribed_to_id: profile.user_id
                            });

                          if (error) throw error;
                          setIsSubscribed(true);
                          toast({
                            title: "Subscribed!",
                            description: `You'll be notified when ${profile.display_name || profile.username} adds new content`,
                          });
                        }
                      } catch (error) {
                        console.error("Error toggling subscription:", error);
                        toast({
                          title: "Error",
                          description: "Failed to update subscription",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="rounded-2xl px-8 h-12 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                    style={{
                      background: isSubscribed 
                        ? "rgba(255, 255, 255, 0.1)"
                        : `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                      color: isSubscribed ? themeColor : "white",
                      border: isSubscribed ? `2px solid ${themeColor}` : "none"
                    }}
                  >
                    {isSubscribed ? (
                      <>
                        <UserCheck className="w-5 h-5 mr-2" />
                        Subscribed
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </motion.div>
              )}

              {/* QR Code Button with Pulse Effect */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  onClick={() => setShowQR(true)}
                  className="gap-2 rounded-2xl px-6 py-6 font-semibold text-base relative overflow-hidden group"
                  style={{ 
                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                    color: "white",
                    border: "2px solid rgba(255,255,255,0.2)",
                    boxShadow: `0 8px 32px ${themeColor}40`
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <QrCode className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">Show QR Code</span>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Modern Pill-Style Tabs with Icons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mb-12"
        >
          <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-2 shadow-xl border border-white/20 max-w-xl mx-auto">
            <div className="grid grid-cols-5 gap-1 relative">
              {/* Animated Background Slider */}
              <motion.div
                layoutId="activeTab"
                className="absolute inset-y-0 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                  boxShadow: `0 4px 20px ${themeColor}50`,
                  width: "calc(20% - 4px)",
                  left:
                    activeTab === "links"
                      ? "4px"
                      : activeTab === "shop"
                        ? "calc(20% + 2px)"
                        : activeTab === "gallery"
                          ? "calc(40% + 0px)"
                          : activeTab === "books"
                            ? "calc(60% - 2px)"
                            : "calc(80% - 4px)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              
              {/* Tab Buttons */}
              <button
                onClick={() => setActiveTab("links")}
                className={`relative z-10 py-3 px-2 rounded-2xl font-semibold text-xs transition-colors duration-300 flex items-center justify-center gap-1 ${
                  activeTab === "links" ? "text-white" : `${getTextColor()} opacity-60`
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">Links</span>
              </button>
              
              <button
                onClick={() => setActiveTab("shop")}
                className={`relative z-10 py-3 px-2 rounded-2xl font-semibold text-xs transition-colors duration-300 flex items-center justify-center gap-1 ${
                  activeTab === "shop" ? "text-white" : `${getTextColor()} opacity-60`
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Shop</span>
              </button>
              
              <button
                onClick={() => setActiveTab("gallery")}
                className={`relative z-10 py-3 px-2 rounded-2xl font-semibold text-xs transition-colors duration-300 flex items-center justify-center gap-1 ${
                  activeTab === "gallery" ? "text-white" : `${getTextColor()} opacity-60`
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Gallery</span>
              </button>
              <button
                onClick={() => setActiveTab("books")}
                className={`relative z-10 py-3 px-2 rounded-2xl font-semibold text-xs transition-colors duration-300 flex items-center justify-center gap-1 ${
                  activeTab === "books" ? "text-white" : `${getTextColor()} opacity-60`
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Books</span>
              </button>
              <button
                onClick={() => setActiveTab("music")}
                className={`relative z-10 py-3 px-2 rounded-2xl font-semibold text-xs transition-colors duration-300 flex items-center justify-center gap-1 ${
                  activeTab === "music" ? "text-white" : `${getTextColor()} opacity-60`
                }`}
              >
                <Music4 className="w-4 h-4" />
                <span className="hidden sm:inline">Music</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tab Content with Slide Animations */}
        <AnimatePresence mode="wait">
          {activeTab === "links" && (
            <motion.div
              key="links"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {linksTabItems.length > 0 ? (
                <div className="space-y-8">
                  {linksTabItems.filter(link => !link.is_shopping_link).length > 0 && (
                    renderLinkSection(linksTabItems.filter(link => !link.is_shopping_link), "Links")
                  )}
                  {linksTabItems.filter(link => link.is_shopping_link).length > 0 && (
                    <div>
                      <h3 className={`text-2xl font-bold mb-6 ${getTextColor()}`}>Featured Products</h3>
                      {renderLinkSection(linksTabItems.filter(link => link.is_shopping_link), "Shop")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-12 text-center border border-white/20">
                  <p className={`${getTextColor()} opacity-60 text-lg`}>No links added yet.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "shop" && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {shopTabItems.length > 0 ? (
                renderLinkSection(shopTabItems, "Shop")
              ) : (
                renderShopEmptyState()
              )}
            </motion.div>
          )}

          {activeTab === "gallery" && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {media.length > 0 ? (
                renderMedia()
              ) : (
                <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-12 text-center border border-white/20">
                  <p className={`${getTextColor()} opacity-60 text-lg`}>No media added yet.</p>
                </div>
              )}
            </motion.div>
          )}

        {activeTab === "books" && (
          <motion.div
            key="books"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {books.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-12 text-center border border-white/20">
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                  <motion.div
                    animate={{ 
                      rotate: [0, -5, 5, -5, 0],
                      scale: [1, 1.05, 1.05, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      ease: "easeInOut",
                      times: [0, 0.2, 0.4, 0.6, 1],
                      repeat: Infinity,
                      repeatDelay: 3
                    }}
                    className="text-8xl mb-6 inline-block"
                  >
                    📚
                  </motion.div>
                  <h3 className={`text-2xl font-bold mb-3 ${getTextColor()}`}>No books yet</h3>
                  <p className={`text-base ${getTextColor()} opacity-70 max-w-md mx-auto`}>
                    This user hasn't created any books yet.
                  </p>
                </motion.div>
              </div>
            ) : (
              <div className={`grid gap-6 ${layoutStyle === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                <AnimatePresence>
                  {books.map((book, index) => (
                    <motion.a
                      key={book.id}
                      href={`/books/${book.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.95 }}
                      transition={{ 
                        duration: 0.4, 
                        delay: index * 0.08,
                        ease: [0.23, 1, 0.32, 1]
                      }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    >
                      <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 relative group">
                        <div 
                          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                          style={{
                            background: `linear-gradient(135deg, ${themeColor}80, transparent)`,
                            filter: "blur(20px)",
                            transform: "scale(1.05)"
                          }}
                        />
                        
                        <div className="p-0">
                          {book.cover_image_url ? (
                            <div className="relative overflow-hidden aspect-[3/4] max-h-48">
                              <img 
                                src={book.cover_image_url} 
                                alt={book.title} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="absolute bottom-4 left-4">
                                  <div 
                                    className="w-10 h-10 rounded-xl backdrop-blur-sm flex items-center justify-center"
                                    style={{ backgroundColor: `${themeColor}40` }}
                                  >
                                    <BookOpen className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="aspect-[3/4] max-h-48 flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)` }}
                            >
                              <BookOpen className="w-16 h-16" style={{ color: themeColor }} />
                            </div>
                          )}
                          <div className="p-5">
                            <h4 className={`font-bold text-lg ${getTextColor()} mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors`}>
                              {book.title}
                            </h4>
                            {book.description && (
                              <p className={`text-sm ${getTextColor()} opacity-70 line-clamp-2`}>
                                {book.description}
                              </p>
                            )}
                            <p className="text-xs mt-3 opacity-50" style={{ color: themeColor }}>
                              {book.created_at ? new Date(book.created_at).toLocaleDateString() : "Recently created"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "music" && (
          <motion.div
            key="music"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {musicTracks.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl p-12 text-center border border-white/20">
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                  <motion.div
                    animate={{ 
                      rotate: [0, -5, 5, -5, 0],
                      scale: [1, 1.05, 1.05, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      ease: "easeInOut",
                      times: [0, 0.2, 0.4, 0.6, 1],
                      repeat: Infinity,
                      repeatDelay: 3
                    }}
                    className="text-8xl mb-6 inline-block"
                  >
                    🎵
                  </motion.div>
                  <h3 className={`text-2xl font-bold mb-3 ${getTextColor()}`}>No music yet</h3>
                  <p className={`text-base ${getTextColor()} opacity-70 max-w-md mx-auto`}>
                    This user hasn't shared any music tracks yet.
                  </p>
                </motion.div>
              </div>
            ) : (
              <div className={`grid gap-6 ${layoutStyle === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                <AnimatePresence>
                  {musicTracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      className="block group"
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.95 }}
                      transition={{ 
                        duration: 0.4, 
                        delay: index * 0.08,
                        ease: [0.23, 1, 0.32, 1]
                      }}
                    >
                      <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-3xl overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 relative group">
                        <div 
                          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                          style={{
                            background: `linear-gradient(135deg, ${themeColor}80, transparent)`,
                            filter: "blur(20px)",
                            transform: "scale(1.05)"
                          }}
                        />
                        
                        <div className="p-0">
                          {track.cover_image_url ? (
                            <div className="relative overflow-hidden aspect-square max-h-48">
                              <img 
                                src={track.cover_image_url} 
                                alt={track.title} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div 
                              className="aspect-square max-h-48 flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)` }}
                            >
                              <Music4 className="w-16 h-16" style={{ color: themeColor }} />
                            </div>
                          )}
                          <div className="p-5">
                            <h4 className={`font-bold text-lg ${getTextColor()} mb-2 line-clamp-2`}>
                              {track.title}
                            </h4>
                            <p className={`text-sm ${getTextColor()} opacity-70`}>
                              {track.genre} • {track.mood} • {track.has_vocals ? "With Vocals" : "Instrumental"}
                            </p>
                            {track.audio_url && (
                              <audio controls src={track.audio_url} className="w-full mt-3 h-8" />
                            )}
                            <p className="text-xs mt-3 opacity-50" style={{ color: themeColor }}>
                              {track.created_at ? new Date(track.created_at).toLocaleDateString() : "Recently created"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-center mt-16 pt-8 border-t border-white/10"
        >
          <div className={`flex items-center justify-center gap-2 ${getTextColor()} opacity-50 hover:opacity-80 transition-opacity`}>
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Powered by Prism Link Spot</span>
          </div>
        </motion.div>
      </div>

      {/* QR Code Dialog with Enhanced Design */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-md backdrop-blur-2xl bg-white/95 dark:bg-black/95 border-2 rounded-3xl p-0 overflow-hidden" style={{ borderColor: `${themeColor}40` }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="text-2xl font-bold text-center" style={{ color: themeColor }}>
                QR Code
              </DialogTitle>
              <p className="text-center text-muted-foreground mt-1">
                {profile.display_name || profile.username}
              </p>
            </DialogHeader>
            <div className="flex flex-col items-center p-6 pt-2 space-y-6">
              <motion.div 
                className="relative p-6 rounded-3xl border-4 shadow-2xl"
                style={{ 
                  borderColor: `${themeColor}40`,
                  background: "white",
                  boxShadow: `0 20px 60px ${themeColor}30`
                }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div 
                  className="absolute inset-0 rounded-3xl blur-2xl opacity-30"
                  style={{ background: themeColor }}
                />
                <QRCodeSVG
                  value={profileUrl}
                  size={220}
                  level="H"
                  includeMargin={true}
                  fgColor={themeColor}
                  className="relative z-10"
                />
              </motion.div>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Scan to visit profile
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Share your profile instantly by letting others scan this QR code
                </p>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog with Enhanced Framer Motion */}
      <AnimatePresence>
        {lightboxUrl && (
          <Dialog open={true} onOpenChange={() => setLightboxUrl(null)}>
            <DialogContent className="max-w-6xl p-0 overflow-hidden bg-black/98 border-none backdrop-blur-2xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.85, rotateY: 10 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.23, 1, 0.32, 1]
                }}
                className="relative"
              >
                <DialogHeader className="p-6 pb-3 bg-gradient-to-b from-black/60 to-transparent">
                  <DialogTitle className="text-white text-2xl font-bold">
                    {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="relative p-6">
                  {lightboxType === "image" ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                      className="relative rounded-2xl overflow-hidden"
                    >
                      <img
                        src={lightboxUrl}
                        alt="Preview"
                        className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                      className="relative rounded-2xl overflow-hidden"
                    >
                      <video
                        src={lightboxUrl}
                        controls
                        controlsList="nodownload"
                        className="w-full h-auto max-h-[80vh] rounded-2xl"
                        autoPlay
                        playsInline
                      />
                    </motion.div>
                  )}
                  {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.description && (
                    <motion.p 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="mt-6 text-base text-gray-300 leading-relaxed px-2"
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
