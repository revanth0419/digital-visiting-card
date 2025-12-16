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

async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Generating image for:", prompt.substring(0, 50) + "...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Image generation failed:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Image generated successfully");
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer", "").trim();

    // Client used only for auth verification using the JWT from the header
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error in generate-book:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Basic server-side rate limiting (per instance)
    const limit = checkRateLimit(`generate-book:${user.id}`, 3, 10 * 60 * 1000);
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

    // Admin client for database writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { prompt, title, description, coverImageData, endImageData } = await req.json();

    if (!prompt || prompt.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Prompt must be at least 10 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating book for user:", user.id, "with prompt:", prompt);

    // Generate book content using Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `You are a creative book writer. Generate a complete story book with 5-8 chapters based on the user's prompt.
              
              Return ONLY valid JSON with this structure:
              {
                "title": "Book Title",
                "description": "A compelling book description (2-3 sentences)",
                "genre": "Fiction/Fantasy/Mystery/Romance/Sci-Fi/etc",
                "chapters": [
                  {
                    "title": "Chapter 1: Introduction",
                    "content": "The chapter content... (3-5 paragraphs per chapter)",
                    "imagePrompt": "A description for an AI to generate an illustration for this chapter"
                  }
                ]
              }
              
              Make the story engaging, complete with a beginning, middle, and end. Each chapter should advance the plot meaningfully.`,
          },
          {
            role: "user",
            content: `Create a book based on this idea: ${prompt}${
              title ? `. Title should be: ${title}` : ""
            }${description ? `. Theme: ${description}` : ""}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a few minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate book content. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("No content in AI response:", aiData);
      return new Response(
        JSON.stringify({ error: "No content generated. Please try a different prompt." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from the AI response
    let bookData;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      bookData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      bookData = {
        title: title || "Generated Story",
        description: description || "A story created with AI",
        genre: "Fiction",
        chapters: [{ title: "Chapter 1", content: content, imagePrompt: "A book illustration" }]
      };
    }

    // Generate cover image if not provided
    let coverImageUrl = coverImageData || null;
    if (!coverImageUrl) {
      const coverPrompt = `Book cover art for "${bookData.title}": ${bookData.description}. Professional, artistic book cover design, high quality illustration, ${bookData.genre} genre style.`;
      coverImageUrl = await generateImage(coverPrompt, LOVABLE_API_KEY);
    }

    // Generate chapter images (limit to first 3 to save resources)
    const chaptersWithImages = [];
    for (let i = 0; i < Math.min(bookData.chapters?.length || 0, 8); i++) {
      const chapter = bookData.chapters[i];
      let chapterImage = null;
      
      // Generate images for first 3 chapters only
      if (i < 3 && chapter.imagePrompt) {
        chapterImage = await generateImage(
          `Book illustration: ${chapter.imagePrompt}. Artistic, detailed, matching ${bookData.genre} genre style.`,
          LOVABLE_API_KEY
        );
      }
      
      chaptersWithImages.push({
        ...chapter,
        image: chapterImage
      });
    }

    // Convert chapters to pages format for storage
    const pages = chaptersWithImages.map(ch => 
      JSON.stringify({
        type: "chapter",
        title: ch.title,
        content: ch.content,
        image: ch.image || null
      })
    );

    // Generate end image if not provided
    let endImageUrl = endImageData || null;
    if (!endImageUrl && coverImageUrl) {
      endImageUrl = coverImageUrl; // Reuse cover for end page
    }

    // Insert the book into the database
    // Note: Large base64 images can cause issues, so we truncate if too large
    const MAX_IMAGE_LENGTH = 500000; // 500KB limit for stored images
    const safeCoverImage = coverImageUrl && coverImageUrl.length > MAX_IMAGE_LENGTH ? null : coverImageUrl;
    const safeEndImage = endImageUrl && endImageUrl.length > MAX_IMAGE_LENGTH ? null : endImageUrl;
    
    console.log("Attempting database insert with:", {
      user_id: user.id,
      title: bookData.title || title || "Untitled Book",
      coverImageLength: safeCoverImage?.length ?? 0,
      endImageLength: safeEndImage?.length ?? 0,
      pagesCount: pages.length,
    });

    const { data: book, error: insertError } = await supabaseAdmin
      .from("books")
      .insert({
        user_id: user.id,
        title: bookData.title || title || "Untitled Book",
        description: bookData.description || description,
        content: JSON.stringify({ ...bookData, chapters: chaptersWithImages }),
        pages: pages,
        cover_image_url: safeCoverImage,
        end_image_url: safeEndImage,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      console.error("Insert error details:", JSON.stringify(insertError, null, 2));
      return new Response(
        JSON.stringify({ error: "Failed to save book: " + (insertError.message || "Unknown database error") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Book created successfully:", book.id);

    return new Response(
      JSON.stringify({
        id: book.id,
        title: book.title,
        description: book.description,
        genre: bookData.genre,
        pages: book.pages,
        coverImageUrl: book.cover_image_url,
        endImageUrl: book.end_image_url,
        createdAt: book.created_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-book function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
