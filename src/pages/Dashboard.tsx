import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Zap, Eye, Search as SearchIcon, HelpCircle } from "lucide-react";

import NotificationsDropdown from "@/components/dashboard/NotificationsDropdown";
import ProfileEditor from "@/components/dashboard/ProfileEditor";
import LinksManager from "@/components/dashboard/LinksManager";
import QRCodeDisplay from "@/components/dashboard/QRCodeDisplay";
import MediaManager from "@/components/dashboard/MediaManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpModal } from "@/components/dashboard/HelpModal";
import { DVCLogo } from "@/components/ui/DVCLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged out",
        description: "See you soon!",
      });
      navigate("/auth");
    }
  };

  const handleViewProfile = async () => {
    if (!session?.user?.id) return;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", session.user.id)
      .single();

    if (error || !profile?.username) {
      toast({
        title: "Profile not found",
        description: "Please complete your profile first.",
      });
    } else {
      window.open(`/u/${profile.username}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <div className="text-center">
            <DVCLogo className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-4 flex-1 min-w-0 mr-2">
            <DVCLogo className="w-9 h-9 text-primary shrink-0" />
            <h1 className="text-lg md:text-2xl font-bold text-gradient truncate">Digital Visiting Card</h1>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/search")} title="Search">
              <SearchIcon className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => navigate("/how-to-use")} title="Help">
              <HelpCircle className="w-5 h-5" />
            </Button>

            <NotificationsDropdown />
            <ThemeToggle />

            <div className="h-6 w-px bg-border mx-2" />

            <Button variant="outline" size="sm" onClick={handleViewProfile}>
              <Eye className="w-4 h-4 mr-2" />
              View Profile
            </Button>

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <NotificationsDropdown />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="w-6 h-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleViewProfile} className="h-10 cursor-pointer">
                  <Eye className="w-4 h-4 mr-2" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/search")} className="h-10 cursor-pointer">
                  <SearchIcon className="w-4 h-4 mr-2" />
                  Search
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/how-to-use")} className="h-10 cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help & Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive h-10 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
            <p className="text-muted-foreground">Manage your profile and links</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <ProfileEditor userId={session.user.id} />
              <QRCodeDisplay userId={session.user.id} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <LinksManager userId={session.user.id} />
              <MediaManager userId={session.user.id} />
            </div>
          </div>
        </div>
        <HelpModal />
      </main>
    </div>
  );
};

export default Dashboard;
