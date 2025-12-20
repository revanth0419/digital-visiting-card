import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // 1. LOG: Function Start
  console.log("Function started");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Auth Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer", "").trim();
    // We use service role for everything to ensure permissions, but validate user simply
    // Ideally we would validate the JWT, but for "ALWAYS 200" robustness we trust the bearer presence for now
    // or strictly: verify with auth client.
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) throw new Error("Invalid token or user not found");

    const { prompt, title, description } = await req.json();

    // 2. LOG: Before AI Call
    console.log("Starting AI generation");

    // AI Logic with Timeout
    let bookData;

    const generateStoryContent = async () => {
      if (!LOVABLE_API_KEY) throw new Error("No AI API Key configured");

      const systemPrompt = `You are a professional book author. Write a complete short story based on the user's prompt.
      REQUIREMENTS:
      - Length: 800-1200 words total.
      - Structure: Split into 6-8 logical chapters.
      - Style: Engaging, descriptive.
      - Format: Return ONLY raw valid JSON. No markdown.
      JSON STRUCTURE:
      {
        "title": "Book Title",
        "description": "Summary",
        "genre": "Genre",
        "chapters": [
          { "title": "Chapter 1", "content": "Full text...", "imagePrompt": "Visual description" }
        ]
      }`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write a story about: ${prompt}. ${title ? `Title: ${title}` : ""}. ${description ? `Theme: ${description}` : ""}` }
          ],
        }),
      });

      if (!res.ok) throw new Error(`AI API failed with status ${res.status}`);

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error("Empty AI response");

      // Parse JSON
      let cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const start = cleanContent.indexOf("{");
      const end = cleanContent.lastIndexOf("}");

      if (start !== -1 && end !== -1) {
        return JSON.parse(cleanContent.substring(start, end + 1));
      }
      throw new Error("Failed to parse AI JSON");
    };

    try {
      // 8 second timeout rule
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI_TIMEOUT")), 8000)
      );

      bookData = await Promise.race([generateStoryContent(), timeoutPromise]);

      // 3. LOG: After AI Call
      console.log("AI generation successful");

    } catch (err) {
      console.error("AI Generation failed or timed out, using fallback:", err);
      // Failover Content
      bookData = {
        title: title || "Generated Story",
        description: description || "A story created with AI (Fallback Mode)",
        genre: "Fiction",
        chapters: [
          {
            title: "Chapter 1: The Beginning",
            content: `The story began with an idea: ${prompt}. Although the AI historian was briefly unavailable to recount the full tale, the essence of the adventure remains. Imagine a world where this prompt comes to life...`,
            imagePrompt: "A mysterious book cover"
          },
          {
            title: "Chapter 2: The End",
            content: "And so, the quick story concludes, awaiting a full retelling another time.",
            imagePrompt: "The end of a book"
          }
        ]
      };
    }

    // 4. LOG: Before DB Insert
    console.log("Inserting book into database");

    // Flatten pages for DB
    const pages = bookData.chapters.map((ch: any) => JSON.stringify({
      type: "chapter",
      title: ch.title,
      content: ch.content,
      image: null
    }));

    const { data: book, error: insertError } = await supabaseClient
      .from("books")
      .insert({
        user_id: user.id,
        title: bookData.title || title || "Untitled",
        description: bookData.description || description,
        content: JSON.stringify(bookData),
        pages: pages,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. LOG: Before Return
    console.log("Returning success response");

    return new Response(
      JSON.stringify({ ok: true, bookId: book.id }),
      {
        status: 200, // ALWAYS 200
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Critical Function Error:", error);

    // 6. ALWAYS 200 ON ERROR
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "Unknown internal error"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
