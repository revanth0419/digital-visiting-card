import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RateLimitRecord = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  const record: RateLimitRecord = existing && now < existing.resetAt
    ? existing
    : { count: 0, resetAt: now + windowMs };

  if (record.count >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  rateBuckets.set(key, record);
  return { allowed: true };
}

// Simple audio synthesis function using Web Audio concepts
// This creates a basic audio file representation
function generateSimpleAudio(prompt: string, duration: number, genre: string): { audioData: string; title: string; description: string } {
  // Create a descriptive response based on the prompt
  const title = `${genre.charAt(0).toUpperCase() + genre.slice(1)} - ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`;
  const description = `A ${duration}-second ${genre} track inspired by: "${prompt}"`;
  
  // Generate a simple WAV header and audio data
  // This is a minimal WAV file with silence (for demo purposes)
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const numSamples = sampleRate * Math.min(duration, 30); // Cap at 30 seconds
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Generate simple tone based on genre
  const frequencies: Record<string, number[]> = {
    lofi: [220, 330, 440],
    electronic: [440, 554.37, 659.25],
    ambient: [261.63, 329.63, 392],
    classical: [293.66, 349.23, 440],
    'hip-hop': [110, 146.83, 220],
    pop: [329.63, 392, 493.88],
    rock: [196, 246.94, 293.66],
    cinematic: [220, 277.18, 329.63],
    devotional: [261.63, 311.13, 392],
    instrumental: [293.66, 369.99, 440],
  };
  
  const freqs = frequencies[genre.toLowerCase()] || frequencies.ambient;
  
  // Write audio samples with a simple chord progression
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Mix frequencies with envelope
    const envelope = Math.min(1, t * 2) * Math.max(0, 1 - (t / (duration * 0.9)));
    
    for (const freq of freqs) {
      sample += Math.sin(2 * Math.PI * freq * t) * 0.2 * envelope;
    }
    
    // Add some variation based on prompt hash
    const promptHash = prompt.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    sample += Math.sin(2 * Math.PI * (200 + (promptHash % 100)) * t) * 0.1 * envelope;
    
    // Clamp and convert to 16-bit
    sample = Math.max(-1, Math.min(1, sample));
    const value = Math.floor(sample * 32767);
    
    // Write stereo
    view.setInt16(offset, value, true);
    view.setInt16(offset + 2, value, true);
    offset += 4;
  }
  
  // Convert to base64
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const audioData = btoa(binary);
  
  return { audioData, title, description };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer", "").trim();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Authenticated user:", user.id);

    // Basic server-side rate limiting (per instance)
    const limit = checkRateLimit(`generate-music:${user.id}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(limit.retryAfterSeconds ?? 60),
          },
        }
      );
    }

    const { prompt, duration = 30, genre = "ambient", mood } = await req.json();

    if (!prompt || prompt.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Prompt must be at least 5 characters describing the music you want" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating music with prompt:", prompt, "duration:", duration, "genre:", genre, "mood:", mood);

    // Build full prompt incorporating mood if provided
    let fullPrompt = prompt.trim();
    if (mood) {
      fullPrompt = `${mood} ${genre} music: ${fullPrompt}`;
    }

    // Check for ElevenLabs API key first
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (ELEVENLABS_API_KEY) {
      // Use ElevenLabs for high-quality music generation
      console.log("Using ElevenLabs for music generation");
      
      const elevenLabsPrompt = genre ? `${genre} music: ${fullPrompt}` : fullPrompt;

      const response = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: elevenLabsPrompt,
          duration_seconds: Math.min(duration, 300),
        }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log("ElevenLabs music generated successfully, size:", audioBuffer.byteLength);

        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
          },
        });
      } else {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", response.status, errorText);
        // Fall through to generated audio
      }
    }

    // Fallback: Generate simple audio locally
    console.log("Generating audio locally");
    
    const clampedDuration = Math.min(Math.max(duration, 5), 30);
    const { audioData, title, description } = generateSimpleAudio(fullPrompt, clampedDuration, genre);
    
    // Return as JSON with base64 audio
    return new Response(
      JSON.stringify({
        status: "ok",
        audioBase64: audioData,
        mime: "audio/wav",
        title,
        description,
        message: "Generated a demo track. For high-quality AI music, configure ELEVENLABS_API_KEY."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-music function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate music" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
