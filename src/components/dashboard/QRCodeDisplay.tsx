import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2, QrCode, Share2, Copy } from "lucide-react";

type QRCodeDisplayProps = {
  userId: string;
};

const QRCodeDisplay = ({ userId }: QRCodeDisplayProps) => {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .single();

    if (data) {
      setUsername(data.username);
      const url = `${window.location.origin}/u/${data.username}`;
      setProfileUrl(url);
    }
    setLoading(false);
  };

  const handleDownload = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${username}-qr-code.png`;
          link.click();
          URL.revokeObjectURL(url);

          toast({
            title: "Success",
            description: "QR code downloaded!",
          });
        }
      });
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied!",
        description: "Profile link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${username}'s Profile`,
          text: `Check out my profile on Prism Link Spot!`,
          url: profileUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
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
    <Card className="glass-card border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gradient">
          <QrCode className="w-5 h-5" />
          Your QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="p-6 bg-white rounded-xl shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
          <QRCodeSVG
            id="qr-code"
            value={profileUrl}
            size={220}
            level="H"
            includeMargin
            fgColor="hsl(270 91% 65%)"
          />
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Scan to view your profile</p>
          <p className="text-xs text-muted-foreground break-all px-4">
            {profileUrl}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full">
          <Button onClick={handleDownload} variant="gradient" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        <Button onClick={handleCopyLink} variant="ghost" size="sm" className="w-full">
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </Button>
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
