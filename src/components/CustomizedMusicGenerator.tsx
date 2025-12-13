import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music4, Download, Wand2, PlayCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const genres = ["lofi", "electronic", "ambient", "classical", "hip-hop", "pop", "rock", "cinematic"];

const clampDuration = (value: number) => {
  if (isNaN(value)) return 10;
  return Math.min(300, Math.max(10, value));
};

const CustomizedMusicGenerator = () => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [genre, setGenre] = useState<string>("lofi");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("sample.mp3");
  const [errorState, setErrorState] = useState<string | null>(null);

  const handleGenerate = async () => {
    setErrorState(null);
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast({ title: "Prompt required", description: "Tell us what to generate.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setAudioUrl(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { "Authorization": `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ prompt: trimmedPrompt, duration: clampDuration(duration), genre }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errorMessage = "Failed to generate music";
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        }

        if (response.status === 503) {
          setErrorState("Music generation requires an ElevenLabs API key. Please contact support to configure it.");
        } else if (response.status === 429) {
          setErrorState("Rate limit exceeded. Please try again later.");
        } else {
          setErrorState(errorMessage);
        }
        return;
      }

      let finalBlob: Blob;
      let finalExtension = "mp3";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.status === "error") throw new Error(data.message);
        if (data.status === "ok" && data.audioBase64) {
          const mime = data.mime || "audio/mpeg";
          const binary = atob(data.audioBase64);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
          finalBlob = new Blob([array], { type: mime });
          finalExtension = mime.includes("wav") ? "wav" : "mp3";
        } else {
          throw new Error("Invalid JSON response from server");
        }
      } else {
        finalBlob = await response.blob();
        finalExtension = contentType?.includes("wav") ? "wav" : "mp3";
      }

      if (finalBlob) {
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setDownloadName(`generated-${genre}.${finalExtension}`);
        toast({ title: "Music ready", description: "Enjoy your track!" });
      } else {
        throw new Error("No audio data received");
      }

    } catch (err: any) {
      console.error("[Music] error", err);
      setErrorState(err.message || "Failed to generate music");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      if (!audioUrl) return;
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Download failed", e);
      toast({ title: "Download failed", description: "Could not download the audio file.", variant: "destructive" });
    }
  };

  if (errorState) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorState}
              <div className="mt-2">
                <Button onClick={() => setErrorState(null)} variant="outline" size="sm">Try Again</Button>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Customized Music Generator</p>
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <Music4 className="w-5 h-5 text-emerald-400" />
            Turn prompts into audio
          </CardTitle>
          <p className="text-sm text-slate-400">
            Describe the vibe, pick duration, choose a genre, then generate.
          </p>
        </div>
        <PlayCircle className="w-8 h-8 text-emerald-400/80" />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-200">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="E.g. Relaxing night-time lofi with gentle rain ambience"
            className="bg-slate-950 border-slate-800"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-slate-200">Duration (10-300 seconds)</Label>
            <Input
              type="number"
              min={10}
              max={300}
              value={duration}
              onChange={(e) => setDuration(clampDuration(Number(e.target.value)))}
              className="bg-slate-950 border-slate-800"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {genres.map((g) => (
                  <SelectItem key={g} value={g} className="capitalize">
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 gap-2"
        >
          {loading ? (
            "Generating..."
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Music
            </>
          )}
        </Button>

        {audioUrl && (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-200">Preview</p>
            <audio controls src={audioUrl} className="w-full" onError={() => toast({ title: "Playback error", description: "The audio could not be played.", variant: "destructive" })} />
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="w-full border-slate-700 text-slate-100 hover:bg-slate-900 gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomizedMusicGenerator;
