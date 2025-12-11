import { useMemo, useState } from "react";
import { Music4, Download, Wand2, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type MusicResponse =
  | { status: "ok"; audioBase64: string; mime?: string }
  | { status: "error"; message?: string };

const genres = ["lofi", "electronic", "ambient", "classical", "hip-hop", "pop", "rock", "cinematic"];

const clampDuration = (value: number) => Math.min(300, Math.max(10, value));

const generateMockWav = (seconds = 2, freq = 440) => {
  const sampleRate = 44100;
  const totalSamples = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  // RIFF/WAVE header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + totalSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, totalSamples * 2, true);

  const amplitude = 0.3 * 0x7fff;
  for (let i = 0; i < totalSamples; i += 1) {
    const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    view.setInt16(44 + i * 2, sample * amplitude, true);
  }

  const uint = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...uint));
  return `data:audio/wav;base64,${base64}`;
};

const CustomizedMusicGenerator = () => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [genre, setGenre] = useState<string>("lofi");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("sample.mp3");
  const mockAudioUrl = useMemo(() => generateMockWav(2, 440), []);

  const setFallbackAudio = () => {
    setAudioUrl(mockAudioUrl);
    setDownloadName("sample.wav");
    toast({
      title: "Using mock audio",
      description: "Backend not available. Playing a sample tone instead.",
    });
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast({ title: "Prompt required", description: "Tell us what to generate.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const { data, error } = await apiFetch<MusicResponse>("/generate-music", {
        method: "POST",
        data: { prompt: trimmedPrompt, duration: clampDuration(duration), genre },
      });

      if (error) {
        console.error("[Music] API error", error);
      }

      if (data && data.status === "ok" && data.audioBase64) {
        const mime = data.mime || "audio/mpeg";
        const url = `data:${mime};base64,${data.audioBase64}`;
        setAudioUrl(url);
        setDownloadName(`generated-${genre}.mp3`);
        toast({ title: "Music ready", description: "Enjoy your track!" });
      } else {
        setFallbackAudio();
      }
    } catch (err) {
      console.error("[Music] unexpected error", err);
      setFallbackAudio();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = downloadName;
    link.click();
  };

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
              onChange={(e) => setDuration(clampDuration(Number(e.target.value) || 0))}
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
            <audio controls src={audioUrl} className="w-full" />
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

