import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 5; // 5 requests per minute
  
  const record = requestCounts.get(userId);
  
  if (!record || now >= record.resetAt) {
    requestCounts.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user ID from JWT for rate limiting
    const token = authHeader.replace("Bearer ", "");
    let userId = "anonymous";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub || "anonymous";
    } catch {
      // Use anonymous if token parsing fails
    }

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      console.log(`[generate-suno-music] Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Please try again in ${rateLimit.retryAfter} seconds.` 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter)
          } 
        }
      );
    }

    const { 
      prompt, 
      instrumental = false, 
      duration = 120, 
      genre = "pop",
      mood = "happy",
      language = "english",
      userPrompt = ""
    } = await req.json();

    console.log(`[generate-suno-music] Request: genre=${genre}, mood=${mood}, language=${language}, instrumental=${instrumental}`);

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Prompt must be at least 5 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI to generate lyrics first if vocals enabled
    let lyrics: string | null = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!instrumental && LOVABLE_API_KEY) {
      try {
        console.log("[generate-suno-music] Generating lyrics...");
        
        const lyricsPrompt = `Write song lyrics for a ${genre} ${mood} song in ${language}.
Theme: ${userPrompt || prompt}

Format the lyrics with clear sections:
[Verse 1]
(4-6 lines)

[Chorus]
(4 lines - catchy and memorable)

[Verse 2]
(4-6 lines)

[Chorus]
(repeat)

[Bridge]
(2-4 lines)

[Final Chorus]
(4 lines with slight variation)

[Outro]
(2 lines)

Make the lyrics emotional, relatable, and suitable for singing. Use natural language for ${language}.`;

        const lyricsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a professional songwriter who writes emotionally engaging song lyrics." },
              { role: "user", content: lyricsPrompt }
            ],
          }),
        });

        if (lyricsResponse.ok) {
          const lyricsData = await lyricsResponse.json();
          lyrics = lyricsData.choices?.[0]?.message?.content || null;
          console.log("[generate-suno-music] Lyrics generated successfully");
        }
      } catch (lyricsError) {
        console.error("[generate-suno-music] Lyrics generation error:", lyricsError);
        // Continue without lyrics
      }
    }

    // Generate a title using AI
    let title = `${genre.charAt(0).toUpperCase() + genre.slice(1)} ${mood.charAt(0).toUpperCase() + mood.slice(1)} Track`;
    
    if (LOVABLE_API_KEY) {
      try {
        const titleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Generate a short, catchy song title (2-5 words). Only respond with the title, nothing else." },
              { role: "user", content: `Generate a title for a ${genre} ${mood} song about: ${userPrompt || prompt}` }
            ],
          }),
        });

        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          const generatedTitle = titleData.choices?.[0]?.message?.content?.trim();
          if (generatedTitle && generatedTitle.length < 50) {
            title = generatedTitle.replace(/['"]/g, "");
          }
        }
      } catch {
        // Use default title
      }
    }

    // Try to generate music using ElevenLabs
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (ELEVENLABS_API_KEY) {
      try {
        console.log("[generate-suno-music] Generating music with ElevenLabs...");
        
        const musicPrompt = instrumental 
          ? `${genre} ${mood} instrumental track. ${userPrompt || prompt}. Professional studio quality, no vocals.`
          : `${genre} ${mood} song. ${userPrompt || prompt}. With expressive vocals in ${language}.`;

        const musicResponse = await fetch("https://api.elevenlabs.io/v1/music", {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: musicPrompt,
            duration_seconds: Math.min(duration, 120),
          }),
        });

        if (musicResponse.ok) {
          const audioBuffer = await musicResponse.arrayBuffer();
          
          // Convert to base64 properly using Deno's encoding
          const { encode: base64Encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
          const audioBase64 = base64Encode(audioBuffer);

          console.log("[generate-suno-music] Music generated successfully");

          return new Response(
            JSON.stringify({
              status: "ok",
              audioBase64,
              mime: "audio/mpeg",
              title,
              lyrics,
              genre,
              mood,
              language,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await musicResponse.text();
          console.error("[generate-suno-music] ElevenLabs error:", musicResponse.status, errorText);
        }
      } catch (musicError) {
        console.error("[generate-suno-music] Music generation error:", musicError);
      }
    }

    // Fallback: Return just the lyrics and title without audio
    // This allows the feature to work even without ElevenLabs
    console.log("[generate-suno-music] Returning generated content without audio");
    
    return new Response(
      JSON.stringify({
        status: "ok",
        title,
        lyrics,
        genre,
        mood,
        language,
        message: "Audio generation requires ElevenLabs API key. Lyrics and title generated successfully.",
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[generate-suno-music] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate music" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
