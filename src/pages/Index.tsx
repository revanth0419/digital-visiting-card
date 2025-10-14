import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Link as LinkIcon, QrCode, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header with Theme Toggle */}
      <div className="container mx-auto px-4 pt-4 flex justify-end">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Zap className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient">
            Prism Link Spot
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your personalized link hub with style. Share all your important links in one beautiful place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="gradient" className="text-lg px-8">
                Get Started Free
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="glass-card border-2 hover:shadow-elegant transition-all duration-300 animate-scale-in">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Unlimited Links</h3>
                <p className="text-muted-foreground">
                  Add as many links as you want. Organize them with drag-and-drop.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-2 hover:shadow-elegant transition-all duration-300 animate-scale-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">QR Code</h3>
                <p className="text-muted-foreground">
                  Get a unique QR code for instant sharing. Perfect for business cards.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-2 hover:shadow-elegant transition-all duration-300 animate-scale-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Custom Themes</h3>
                <p className="text-muted-foreground">
                  Personalize your profile with custom colors and styles.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <Card className="glass-card border-2 max-w-3xl mx-auto">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Create your free profile in seconds. No credit card required.
            </p>
            <Link to="/auth">
              <Button size="lg" variant="gradient" className="text-lg px-8">
                Create Your Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5" />
            <span className="font-semibold">Prism Link Spot</span>
          </div>
          <p className="text-sm">Built with modern web technologies</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
