import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type QRCodeDisplayProps = {
  userId: string;
};

const QRCodeDisplay = ({ userId }: QRCodeDisplayProps) => {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

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
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${username}-qrcode.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
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
    <Card className="glass-card border-2">
      <CardHeader>
        <CardTitle>QR Code</CardTitle>
        <CardDescription>Share your profile instantly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg shadow-elegant">
            <QRCodeSVG
              id="qr-code"
              value={profileUrl}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center break-all">
            {profileUrl}
          </p>
        </div>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
