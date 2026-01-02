import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Link2, Palette, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HelpModal = () => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const hasSeenHelp = localStorage.getItem("hasSeenHelpModal");
        if (!hasSeenHelp) {
            // Small delay to show after initial load
            const timer = setTimeout(() => setOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setOpen(false);
        localStorage.setItem("hasSeenHelpModal", "true");
    };

    const handleDetailedGuide = () => {
        handleClose();
        navigate("/how-to-use");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">Welcome to Digital Visiting Card!</DialogTitle>
                    <DialogDescription className="text-center">
                        Here's how to get started in 3 simple steps:
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-full mt-1">
                            <Link2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Add Your Links</h3>
                            <p className="text-sm text-muted-foreground">Click "Add New Link" to share your website, social media, and more.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-accent/10 rounded-full mt-1">
                            <Palette className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Customize Page</h3>
                            <p className="text-sm text-muted-foreground">Go to Profile settings to change your theme, background, and layout.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-500/10 rounded-full mt-1">
                            <Share2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Share Profile</h3>
                            <p className="text-sm text-muted-foreground">Use the QR code or copy your unique URL to share your page.</p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={handleDetailedGuide} className="w-full sm:w-auto">
                        View Full Guide
                    </Button>
                    <Button variant="gradient" onClick={handleClose} className="w-full sm:w-auto">
                        Got it, thanks!
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
