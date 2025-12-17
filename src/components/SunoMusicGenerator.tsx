import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Music4, Download, Wand2, PlayCircle, AlertCircle, 
  RefreshCw, Share2, Volume2, VolumeX, Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";

const genres = [
  { value: "pop", label: "Pop" },
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "rock", label: "Rock" },
  { value: "lofi", label: "Lo-Fi" },
  { value: "classical", label: "Classical" },
  { value: "edm", label: "EDM" },
  { value: "devotional", label: "Devotional" },
  { value: "cinematic", label: "Cinematic" },
  { value: "jazz", label: "Jazz" },
  { value: "r&b", label: "R&B" },
];

const moods = [
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
  { value: "romantic", label: "Romantic" },
  { value: "mysterious", label: "Mysterious" },
  { value: "intense", label: "Intense" },
  { value: "peaceful", label: "Peaceful" },
];

const languages = [
  { value: "english", label: "English" },
  { value: "telugu", label: "Telugu" },
  { value: "hindi", label: "Hindi" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "korean", label: "Korean" },
  { value: "japanese", label: "Japanese" },
];

type LoadingStage = "idle" | "writing" | "composing" | "recording" | "done";

const SunoMusicGenerator = () => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("pop");
  const [mood, setMood] = useState("happy");
  const [language, setLanguage] = useState("english");
  const [vocalsEnabled, setVocalsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Generated content
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const buildSunoPrompt = () => {
    if (vocalsEnabled) {
      return `A ${genre} ${mood} song in ${language}.
Theme: ${prompt}.
Include expressive vocals, natural human-like singing,
clear pronunciation, professional studio-quality sound.
Song structure must include:
Verse 1, Chorus, Verse 2, Chorus, Bridge, Final Chorus, Outro.
Duration: 1–2 minutes.`;
    } else {
      return `A ${genre} ${mood} instrumental music track.
Theme: ${prompt}.
No vocals.
Smooth transitions, rich textures,
cinematic studio-quality sound.
Duration: 1–2 minutes.`;
    }
  };

  const simulateLoadingStages = async () => {
    if (vocalsEnabled) {
      setLoadingStage("writing");
      await new Promise(r => setTimeout(r, 2000));
      setLoadingStage("composing");
      await new Promise(r => setTimeout(r, 3000));
      setLoadingStage("recording");
    } else {
      setLoadingStage("composing");
    }
  };

  const handleGenerate = async () => {
    setErrorState(null);
    const trimmedPrompt = prompt.trim();
    
    if (!trimmedPrompt || trimmedPrompt.length < 5) {
      toast({ 
        title: "Describe your song", 
        description: "Please describe the song you want (at least 5 characters).", 
        variant: "destructive" 
      });
      return;
    }

    // Check if user is logged in
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast({ 
        title: "Login required", 
        description: "Please log in to generate music.", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    setAudioUrl(null);
    setSongTitle(null);
    setLyrics(null);
    setCoverImage(null);

    // Start loading stage simulation
    simulateLoadingStages();

    try {
      const sunoPrompt = buildSunoPrompt();
      const accessToken = sessionData.session.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-suno-music`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          prompt: sunoPrompt,
          instrumental: !vocalsEnabled,
          duration: 120,
          genre,
          mood,
          language,
          userPrompt: trimmedPrompt,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errorMessage = "Failed to generate music";
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        }

        if (response.status === 503) {
          setErrorState("Music generation service is temporarily unavailable. Please try again later.");
        } else if (response.status === 429) {
          setErrorState("Rate limit exceeded. Please try again later.");
        } else if (response.status === 402) {
          setErrorState("Please add credits to your account to generate music.");
        } else {
          setErrorState(errorMessage);
        }
        return;
      }

      const data = await response.json();
      
      if (data.status === "error") {
        throw new Error(data.message || "Generation failed");
      }

      // Handle audio
      if (data.audioBase64) {
        const mime = data.mime || "audio/mpeg";
        const binary = atob(data.audioBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: mime });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else if (data.audio_url) {
        setAudioUrl(data.audio_url);
      }

      // Set metadata
      setSongTitle(data.title || `${genre.charAt(0).toUpperCase() + genre.slice(1)} ${mood} Track`);
      setLyrics(data.lyrics || null);
      setCoverImage(data.image_url || data.coverImage || null);

      setLoadingStage("done");
      toast({ title: "Song generated!", description: "Your track is ready to play." });

    } catch (err: any) {
      console.error("[SunoMusic] error", err);
      setErrorState(err.message || "Failed to generate music");
    } finally {
      setLoading(false);
      if (loadingStage !== "done") {
        setLoadingStage("idle");
      }
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${songTitle || "generated-song"}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!audioUrl) return;
    try {
      await navigator.share({
        title: songTitle || "AI Generated Song",
        text: `Check out this ${genre} song I created!`,
        url: window.location.href,
      });
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
    }
  };

  const handleRegenerate = () => {
    setAudioUrl(null);
    setSongTitle(null);
    setLyrics(null);
    setCoverImage(null);
    setLoadingStage("idle");
    handleGenerate();
  };

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case "writing": return "Writing lyrics...";
      case "composing": return "Composing music...";
      case "recording": return "Recording vocals...";
      default: return "Generating...";
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
              <div className="mt-3">
                <Button onClick={() => setErrorState(null)} variant="outline" size="sm">
                  Try Again
                </Button>
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
          <p className="text-xs text-slate-400">AI Music Generator</p>
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <Music4 className="w-5 h-5 text-purple-400" />
            Suno-Style Music Creator
          </CardTitle>
          <p className="text-sm text-slate-400">
            Create professional AI-generated songs with vocals or instrumentals
          </p>
        </div>
        <PlayCircle className="w-8 h-8 text-purple-400/80" />
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Prompt Input */}
        <div className="space-y-2">
          <Label className="text-slate-200">Describe your song</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="E.g. A summer love story about meeting someone at the beach..."
            className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 resize-none"
            disabled={loading}
          />
        </div>

        {/* Options Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-slate-200">Genre</Label>
            <Select value={genre} onValueChange={setGenre} disabled={loading}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {genres.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Mood</Label>
            <Select value={mood} onValueChange={setMood} disabled={loading}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {moods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Language</Label>
            <Select value={language} onValueChange={setLanguage} disabled={loading}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {languages.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Vocals Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center gap-3">
            {vocalsEnabled ? (
              <Volume2 className="w-5 h-5 text-purple-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">Vocals</p>
              <p className="text-xs text-slate-400">
                {vocalsEnabled ? "Include AI-generated singing" : "Instrumental only"}
              </p>
            </div>
          </div>
          <Switch
            checked={vocalsEnabled}
            onCheckedChange={setVocalsEnabled}
            disabled={loading}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-purple-600 text-white hover:bg-purple-500 gap-2 h-12"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {getLoadingMessage()}
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate Song
            </>
          )}
        </Button>

        {/* Loading Progress */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                {["writing", "composing", "recording"].map((stage, i) => {
                  const stages = ["writing", "composing", "recording"];
                  const currentIndex = stages.indexOf(loadingStage);
                  const isActive = i <= currentIndex;
                  const isCurrent = stage === loadingStage;
                  
                  if (!vocalsEnabled && stage === "writing") return null;
                  if (!vocalsEnabled && stage === "recording") return null;
                  
                  return (
                    <div
                      key={stage}
                      className={`flex-1 h-1.5 rounded-full transition-all ${
                        isActive 
                          ? isCurrent 
                            ? "bg-purple-500 animate-pulse" 
                            : "bg-purple-600"
                          : "bg-slate-800"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-center text-slate-400">
                {getLoadingMessage()}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Output Section */}
        <AnimatePresence>
          {audioUrl && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4 rounded-lg border border-purple-800/50 bg-slate-950 p-4"
            >
              {/* Cover & Title */}
              <div className="flex gap-4">
                {coverImage && (
                  <img 
                    src={coverImage} 
                    alt={songTitle || "Song cover"} 
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-slate-100">
                    {songTitle}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {genre.charAt(0).toUpperCase() + genre.slice(1)} • {mood} • {language}
                  </p>
                  {!vocalsEnabled && (
                    <span className="inline-block mt-1 text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      Instrumental
                    </span>
                  )}
                </div>
              </div>

              {/* Audio Player */}
              <audio 
                controls 
                src={audioUrl} 
                className="w-full" 
                onError={() => toast({ 
                  title: "Playback error", 
                  description: "The audio could not be played.", 
                  variant: "destructive" 
                })} 
              />

              {/* Lyrics Section */}
              {lyrics && (
                <div className="space-y-2">
                  <Label className="text-slate-200">Lyrics</Label>
                  <div className="max-h-48 overflow-y-auto p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                      {lyrics}
                    </pre>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="border-slate-700 text-slate-100 hover:bg-slate-800 gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  className="border-slate-700 text-slate-100 hover:bg-slate-800 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="border-slate-700 text-slate-100 hover:bg-slate-800 gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default SunoMusicGenerator;
