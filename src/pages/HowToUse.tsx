import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, UserPlus, Settings, Link2, Share2, Palette } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/providers/AuthProvider";

const HowToUse = () => {
    const { session } = useAuth();
    const steps = [
        {
            icon: <UserPlus className="w-8 h-8 text-primary" />,
            title: "1. Create Account",
            description: "Sign up for a free account. Choose a unique username that will be part of your personal URL (e.g., dvc.vinofyx.com/yourname)."
        },
        {
            icon: <Settings className="w-8 h-8 text-secondary" />,
            title: "2. Set Up Profile",
            description: "Go to your dashboard. Upload a profile picture, write a bio, and add your social media links."
        },
        {
            icon: <Link2 className="w-8 h-8 text-accent" />,
            title: "3. Add & Manage Links",
            description: "Use the 'Add Link' button to create new links. You can reorder them by dragging and dropping."
        },
        {
            icon: <Palette className="w-8 h-8 text-pink-500" />,
            title: "4. Customize Your Page",
            description: "Choose a theme that matches your style. You can select from dark, light, or gradient themes."
        },
        {
            icon: <Share2 className="w-8 h-8 text-green-500" />,
            title: "5. Share Your Link",
            description: "Copy your unique profile URL or download your QR code to share on WhatsApp, Instagram and other platforms."
        }
    ];

    return (
        <div className="min-h-screen gradient-mesh p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center gap-4">
                    <Link to={session ? "/dashboard" : "/"}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold text-gradient">How to Use Digital Visiting Card</h1>
                </div>

                <div className="space-y-6">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="glass-card border-none shadow-lg hover:shadow-xl transition-all duration-300">
                                <CardContent className="p-6 flex items-start gap-4 sm:gap-6">
                                    <div className="p-3 bg-white/10 rounded-2xl shadow-inner">
                                        {step.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold mb-2">{step.title}</h2>
                                        <p className="text-muted-foreground text-lg">{step.description}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <Link to="/auth?mode=signup">
                        <Button size="lg" variant="gradient" className="text-lg px-8 shadow-lg hover:scale-105 transition-transform">
                            Get Started Now
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HowToUse;
