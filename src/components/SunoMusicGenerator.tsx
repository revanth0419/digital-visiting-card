import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Music4,
  Download,
  Wand2,
  PlayCircle,
  AlertCircle,
  RefreshCw,
  Share2,
  Volume2,
  VolumeX,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";

/* ---------- CONSTANTS ---------- */

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

type MusicTrack = {
  id: string;
  title: string;
  prompt: string | null;
  genre: string | null;
  mood: string | null;
  language: string | null;
  has_vocals: boolean;
  lyrics: string | null;
  audio_url: string | null;
  cover_image_url: string | null;
  show_on_profile: boolean;
  created_at: string;
};

/* ---------- COMPONENT ---------- */

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
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [savedTracks, setSavedTracks] = useState<MusicTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  /* ---------- EFFECTS ---------- */

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) loadSavedTracks(data.user.id);
    };
    load();
  }, []);

  const loadSavedTracks = async (uid: string) => {
    setLoadingTracks(true);
    const { data } = await supabase
      .from("music_tracks")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (data) setSavedTracks(data as MusicTrack[]);
    setLoadingTracks(false);
  };

  /* ---------- GENERATION ---------- */

  const buildPrompt = () =>
    vocalsEnabled
      ? `A ${genre} ${mood} song in ${language}. Theme: ${prompt}`
      : `A ${genre} ${mood} instrumental track. Theme: ${prompt}`;

  const handleGenerate = async () => {
    setErrorState(null);
    setApiMessage(null);
    if (prompt.trim().length < 5) {
      toast({
        title: "Describe your song",
        description: "Please enter at least 5 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-suno-music",
        {
          body: {
            prompt,
            genre,
            mood,
            language,
            instrumental: !vocalsEnabled, // Correctly passing the flag
          },
        }
      );

      if (error) throw error;

      if (data?.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: data.mime || "audio/wav" });
        setAudioUrl(URL.createObjectURL(blob));
      } else if (data?.message) {
        setApiMessage(data.message);
      }

      setSongTitle(data?.title || "Generated Track");
      if (data?.lyrics) setLyrics(data.lyrics);

      toast({ title: "Song generated successfully 🎵" });
    } catch (e: any) {
      setErrorState(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI ---------- */

  if (errorState) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorState}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music4 className="w-5 h-5 text-purple-400" />
          AI Music Generator
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mood</Label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Select mood" />
              </SelectTrigger>
              <SelectContent>
                {moods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950">
            <div className="space-y-0.5">
              <Label className="text-base">Vocals</Label>
              <p className="text-xs text-slate-500">Enable AI vocals</p>
            </div>
            <Switch
              checked={vocalsEnabled}
              onCheckedChange={setVocalsEnabled}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Song Description</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the story or theme of your song (e.g., A heartbreak in the rain)..."
            className="bg-slate-950 border-slate-800 min-h-[80px]"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating Music...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" /> Generate Song
            </>
          )}
        </Button>

        {/* Results Section */}
        {(audioUrl || songTitle) && (
          <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-300">
                  {songTitle || "Generated Track"}
                </h3>
                <p className="text-xs text-slate-400 capitalize">
                  {genre} • {mood} • {language}
                </p>
              </div>
            </div>

            {apiMessage && (
              <Alert className="bg-orange-950/50 border-orange-800 text-orange-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {apiMessage}
                </AlertDescription>
              </Alert>
            )}

            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 mt-2 rounded"
              />
            )}

            {lyrics && (
              <div className="pt-2">
                <Label className="text-xs text-slate-500 mb-2 block">Lyrics</Label>
                <div className="max-h-48 overflow-y-auto p-3 rounded-md bg-slate-900 border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {lyrics}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SunoMusicGenerator;
