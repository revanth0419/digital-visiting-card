import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import prisma from "../lib/prisma.ts";
import { openai } from "./openaiClient.ts";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { createRateLimitMiddleware } from "./rateLimit.ts";

const app = express();

// Initialize Supabase client for auth verification
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

const staticOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://192.168.55.105:8081",
  "http://192.168.55.105:8080",
  "http://192.168.55.105:5173",
  "http://192.168.55.105:4001",
];

const lanRegexes = [
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
];

const isOriginAllowed = (origin?: string | null) => {
  if (!origin) return true;
  if (staticOrigins.includes(origin)) return true;
  return lanRegexes.some((re) => re.test(origin));
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Authentication middleware - verifies Supabase JWT token
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("[Auth] Token verification failed:", error?.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error: any) {
    console.error("[Auth] Authentication error:", error?.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// Authorization middleware - verifies user owns the resource
const requireOwnership = (userIdParam: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({ error: "You can only access your own resources" });
    }

    next();
  };
};

const defaultProfileForUser = async (userId: string) => {
  const safeUsername = `user-${userId.slice(0, 8)}`;
  return prisma.profile.create({
    data: {
      user_id: userId,
      username: safeUsername,
      display_name: null,
      bio: null,
      theme_color: "#8b5cf6",
      layout_style: "list",
      profile_theme: "default",
      background_type: "gradient",
    },
  });
};

const getOrCreateProfile = async (userId: string) => {
  const existing = await prisma.profile.findUnique({ where: { user_id: userId } });
  if (existing) return existing;
  return defaultProfileForUser(userId);
};

const ensureModel = <T>(client: any, model: string): T => {
  const m = client?.[model];
  if (!m) {
    throw new Error(`Prisma model "${model}" is missing. Run "npx prisma generate" and ensure migrations are applied.`);
  }
  return m as T;
};

const runBackendDiagnostics = async () => {
  const results: string[] = [];
  const fail = (msg: string) => results.push(`✖ ${msg}`);
  const ok = (msg: string) => results.push(`✔ ${msg}`);

  if (process.env.DATABASE_URL) {
    ok("DATABASE_URL present");
  } else {
    fail("Missing DATABASE_URL");
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("Prisma & PostgreSQL reachable");
  } catch (err: any) {
    fail(`PostgreSQL connection failed: ${err?.message}`);
  }

  try {
    await access("src/server/openaiClient.ts", fsConstants.F_OK);
    ok("openaiClient.ts present");
  } catch {
    fail("Missing file: src/server/openaiClient.ts");
  }

  try {
    await access("src/lib/prisma.ts", fsConstants.F_OK);
    ok("prisma.ts present");
  } catch {
    fail("Missing file: src/lib/prisma.ts");
  }

  if (process.env.OPENAI_API_KEY) {
    ok("OPENAI_API_KEY present");
  } else {
    fail("Missing OPENAI_API_KEY");
  }

  if (process.env.VITE_API_BASE_URL) {
    ok(`VITE_API_BASE_URL set (${process.env.VITE_API_BASE_URL})`);
  } else {
    ok("VITE_API_BASE_URL not set (frontend will use default http://localhost:4000/api or host-based fallback)");
  }

  const originsSummary = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:4173",
    "LAN 192.168.*.*",
    "LAN 10.*.*.*",
  ].join(", ");
  ok(`CORS origins configured for: ${originsSummary}`);

  results.unshift("==== BACKEND DIAGNOSTICS ====");
  results.push("==============================");
  console.log(results.join("\n"));
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Profiles
app.get("/api/profiles/search", async (req, res) => {
  const query = String(req.query.q || "");
  const limit = Number(req.query.limit || 20);
  try {
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { display_name: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
    });
    res.json({ data: profiles, error: null });
  } catch (error: any) {
    console.error("Error searching profiles:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to search profiles" });
  }
});

app.get("/api/profiles/username/:username", async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username },
    });
    res.json({ data: profile, error: null });
  } catch (error: any) {
    console.error("Error fetching profile by username:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to fetch profile" });
  }
});

app.get("/api/profiles/by-user/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    res.json({ data: profile, error: null });
  } catch (error: any) {
    console.error("Error fetching profile by user:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to fetch profile" });
  }
});

app.put("/api/profiles/:userId", requireAuth, requireOwnership("userId"), async (req, res) => {
  const {
    display_name,
    bio,
    theme_color,
    layout_style,
    profile_theme,
    background_url,
    background_type,
    avatar_url,
    username,
  } = req.body;
  try {
    // Use authenticated user's ID for security
    const userId = req.user!.id;
    const existing = await prisma.profile.findUnique({ where: { user_id: userId } });
    const resolvedUsername = existing?.username || username || `user-${userId.slice(0, 8)}`;

    const profile = await prisma.profile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        username: resolvedUsername,
        display_name: display_name ?? null,
        bio: bio ?? null,
        theme_color: theme_color ?? "#8b5cf6",
        layout_style: layout_style ?? "list",
        profile_theme: profile_theme ?? "default",
        background_url: background_url ?? null,
        background_type: background_type ?? "gradient",
        avatar_url: avatar_url ?? null,
      },
      update: {
        display_name,
        bio,
        theme_color,
        layout_style,
        profile_theme,
        background_url,
        background_type,
        avatar_url,
      },
    });
    res.json({ data: profile, error: null });
  } catch (error: any) {
    console.error("Error upserting profile:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to save profile" });
  }
});

// Links
app.get("/api/links", async (req, res) => {
  const profileId = String(req.query.profileId || "");
  const active = req.query.active === "true" ? true : undefined;
  try {
    if (!profileId) {
      return res.json({ data: [], error: null });
    }
    const linkClient = ensureModel<typeof prisma.link>(prisma, "link");
    const links = await linkClient.findMany({
      where: {
        profile_id: profileId || undefined,
        is_active: active,
      },
      orderBy: { order_index: "asc" },
    });
    res.json({ data: links, error: null });
  } catch (error: any) {
    console.error("Error fetching links:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to fetch links" });
  }
});

app.post("/api/links", requireAuth, async (req, res) => {
  const { profile_id, title, url, icon, image_url, price, order_index, is_shopping_link, show_in_links } = req.body;
  try {
    // Verify user owns this profile
    const profile = await prisma.profile.findUnique({ where: { id: profile_id } });
    if (!profile || profile.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only add links to your own profile" });
    }

    const linkClient = ensureModel<typeof prisma.link>(prisma, "link");
    const link = await linkClient.create({
      data: {
        profile_id,
        title,
        url,
        icon,
        image_url,
        price,
        order_index: Number(order_index || 0),
        is_shopping_link: Boolean(is_shopping_link),
        show_in_links: Boolean(show_in_links ?? true),
      },
    });
    res.json({ data: link, error: null });
  } catch (error: any) {
    console.error("Error creating link:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to create link" });
  }
});

app.delete("/api/links/:id", requireAuth, async (req, res) => {
  try {
    const linkClient = ensureModel<typeof prisma.link>(prisma, "link");
    
    // Verify ownership before deleting
    const link = await linkClient.findUnique({ 
      where: { id: req.params.id },
      include: { profile: true }
    });
    
    if (!link || link.profile.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only delete your own links" });
    }

    await linkClient.delete({ where: { id: req.params.id } });
    res.json({ data: link, error: null });
  } catch (error: any) {
    console.error("Error deleting link:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to delete link" });
  }
});

app.put("/api/links/order", requireAuth, async (req, res) => {
  const updates: { id: string; order_index: number }[] = req.body?.updates || [];
  try {
    // Verify ownership of all links being updated
    const linkIds = updates.map(u => u.id);
    const links = await prisma.link.findMany({
      where: { id: { in: linkIds } },
      include: { profile: true }
    });
    
    const unauthorized = links.some(link => link.profile.user_id !== req.user!.id);
    if (unauthorized) {
      return res.status(403).json({ error: "You can only reorder your own links" });
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.link.update({
          where: { id: u.id },
          data: { order_index: Number(u.order_index) },
        })
      )
    );
    res.json({ data: true, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

// Media
app.get("/api/media", async (req, res) => {
  const profileId = String(req.query.profileId || "");
  try {
    if (!profileId) {
      return res.json({ data: [], error: null });
    }
    const mediaClient = ensureModel<typeof prisma.media>(prisma, "media");
    const media = await mediaClient.findMany({
      where: { profile_id: profileId || undefined },
      orderBy: { order_index: "asc" },
    });
    res.json({ data: media, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.post("/api/media", requireAuth, async (req, res) => {
  const { profile_id, type, url, title, description, order_index } = req.body;
  try {
    // Verify user owns this profile
    const profile = await prisma.profile.findUnique({ where: { id: profile_id } });
    if (!profile || profile.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only add media to your own profile" });
    }

    const mediaClient = ensureModel<typeof prisma.media>(prisma, "media");
    const media = await mediaClient.create({
      data: {
        profile_id,
        type,
        url,
        title,
        description,
        order_index: Number(order_index || 0),
      },
    });
    res.json({ data: media, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.delete("/api/media/:id", requireAuth, async (req, res) => {
  try {
    const mediaClient = ensureModel<typeof prisma.media>(prisma, "media");
    
    // Verify ownership before deleting
    const media = await mediaClient.findUnique({ 
      where: { id: req.params.id },
      include: { profile: true }
    });
    
    if (!media || media.profile.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only delete your own media" });
    }

    await mediaClient.delete({ where: { id: req.params.id } });
    res.json({ data: media, error: null });
  } catch (error) {
    console.error("Error deleting media:", error);
    res.status(500).json({ data: null, error: (error as any)?.message || "Failed to delete media" });
  }
});


// Music
app.post(
  "/api/generate-music",
  createRateLimitMiddleware({ name: "generate_music", max: 30, windowMs: 60_000 }),
  async (req, res) => {
    const { prompt, duration, genre } = req.body;
    try {
      // Generate a simple sine wave WAV file in memory
      const sampleRate = 44100;
      const numChannels = 1;
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const actualDuration = Math.min(30, Math.max(1, Number(duration) || 5));
      const numSamples = sampleRate * actualDuration;
      const dataSize = numSamples * blockAlign;
      const bufferSize = 44 + dataSize;

      const buffer = Buffer.alloc(bufferSize);

      // RIFF header
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(bufferSize - 8, 4);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(numChannels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(byteRate, 28);
      buffer.writeUInt16LE(blockAlign, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write("data", 36);
      buffer.writeUInt32LE(dataSize, 40);

      // Data
      const freqBase = genre === "lofi" ? 220 : genre === "rock" ? 110 : 440;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = freqBase * (1 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t));
        const sample = Math.sin(2 * Math.PI * freq * t) * 0.5;
        const val = Math.max(-32768, Math.min(32767, sample * 32767));
        buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
      }

      res.setHeader("Content-Type", "audio/wav");
      res.send(buffer);
    } catch (error: any) {
      console.error("[Music] Error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

app.post(
  "/api/books/generate",
  requireAuth,
  createRateLimitMiddleware({
    name: "books_generate",
    max: 3,
    windowMs: 10 * 60 * 1000,
    keyFn: (req) => `user:${req.user?.id ?? "unknown"}`,
  }),
  async (req, res) => {
  try {
    console.log("[books/generate] incoming body:", { ...req.body, coverImageData: req.body.coverImageData ? "present" : "missing" });
    const { prompt, title, description, coverImageData, endImageData } = req.body;
    
    // Use authenticated user's ID for security
    const userId = req.user!.id;

    if (!prompt) {
      return res.status(400).json({
        data: null,
        error: "Missing prompt"
      });
    }

    // Generate book content using OpenAI with fallback
    let content = "";
    try {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert novelist." },
          { role: "user", content: `Write a detailed, multi-chapter book based on this idea: ${prompt}` }
        ],
        max_tokens: 4000
      });

      content = aiResponse.choices[0]?.message?.content ?? "";

      if (!content.trim()) {
        throw new Error("OpenAI returned empty content");
      }

      console.log("[books/generate] OpenAI content generated, length:", content.length);
    } catch (openaiError: any) {
      console.error("[books/generate] OpenAI error:", openaiError);
      console.error("[books/generate] OpenAI error details:", {
        message: openaiError?.message,
        status: openaiError?.status,
        code: openaiError?.code
      });

      // FALLBACK: Create offline book instead of returning 500
      content =
        `Offline Book Fallback\n\n` +
        `We could not reach OpenAI, so this is a basic book generated by the server.\n\n` +
        `Prompt: ${prompt}\n\n` +
        `Chapter 1: Beginning\n\n` +
        `This is a placeholder chapter for the story about: ${prompt}\n\n` +
        `The full story would explore themes related to this concept and develop characters ` +
        `and plotlines based on the idea you provided. Since we're operating in offline mode, ` +
        `this is a simplified version that demonstrates the book generation feature.\n\n` +
        `Chapter 2: Development\n\n` +
        `As the story progresses, we would see how the central idea of "${prompt}" unfolds ` +
        `through various narrative elements and character interactions.\n\n` +
        `Chapter 3: Conclusion\n\n` +
        `The story would conclude by resolving the main conflicts and themes introduced ` +
        `throughout the narrative, bringing closure to the tale of "${prompt}".\n`;

      console.log("[books/generate] Using fallback content due to OpenAI error");
    }

    // Split content into pages for reading experience
    function splitContentIntoPages(content: string, wordsPerPage = 300): string[] {
      const words = content.split(/\s+/).filter(Boolean);
      const pages: string[] = [];

      for (let i = 0; i < words.length; i += wordsPerPage) {
        pages.push(words.slice(i, i + wordsPerPage).join(" "));
      }

      return pages.length > 0 ? pages : [content];
    }

    console.log("[books/generate] Content generation complete. Length:", content.length);

    const pages = splitContentIntoPages(content, 300);
    console.log("[books/generate] Content split into", pages.length, "pages");

    // Generate cover image using OpenAI (with fallback)
    let coverImageUrl: string | null = null;
    let endImageUrl: string | null = null;

    // If user uploaded a specific cover, we can use that (assuming it's a URL or base64 we need to store)
    // For simplicity, if it's base64, we might need to upload it or store it large (DB limits).
    // The user said "return them in the response along with pages".
    // If coverImageData is provided (as base64 or URL), use it.

    if (coverImageData) {
      coverImageUrl = coverImageData; // Assume it's a usable string (url or data uri)
      console.log("[books/generate] Using user-provided cover image");
    }

    if (endImageData) {
      endImageUrl = endImageData;
    }

    const finalTitle = title || "Untitled Book";

    try {
      if (!coverImageUrl) {
        console.log("[books/generate] Generating cover image...");

        const imagePrompt = `
      Create a professional, detailed book cover illustration for a novel titled "${finalTitle}".
      The cover should represent this story idea: ${prompt}.
      No text, no words, no logos. Just artwork.
      Cinematic lighting, vibrant colors, highly detailed, in a fantasy/sci-fi illustration style.
      `;

        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: imagePrompt,
          size: "1024x1024",
          n: 1,
        });

        coverImageUrl = imageResponse.data?.[0]?.url ?? null;

        console.log("[books/generate] Cover image generated:", coverImageUrl);
      }
    } catch (imageError: any) {
        console.error("[books/generate] OpenAI image error:", {
          message: imageError?.message,
          status: imageError?.response?.status,
          data: imageError?.response?.data
        });

        // fallback image could be added later
        coverImageUrl = null;
      }

      // Create book in database using Prisma Book model
      const bookClient = ensureModel<any>(prisma, "book");
      const book = await bookClient.create({
        data: {
          userId,
          title: finalTitle,
          description: description || content.slice(0, 200) + "...",
          content,
          pages,
          coverImageUrl,
          endImageUrl,
        },
      });

      console.log("[books/generate] Book created successfully:", book.id);
      return res.status(201).json({ data: book, error: null });
    } catch (error: any) {
      console.error("[books/generate] error:", error);
      console.error("[books/generate] error stack:", error?.stack);
      console.error("[books/generate] error details:", {
        message: error?.message,
        code: error?.code,
        meta: error?.meta
      });
      return res.status(500).json({
        data: null,
        error: "Book generation failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

app.get("/api/books/by-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      console.log("[books/by-user] No userId provided, returning empty array");
      return res.json({ data: [], error: null });
    }

    const bookClient = ensureModel<any>(prisma, "book");
    const books = await bookClient.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    console.log("[books/by-user] returning", books.length, "books for", userId);
    // Return empty array if no books, not 404
    return res.json({ data: books || [], error: null });
  } catch (error: any) {
    console.error("[books/by-user] error:", error);
    console.error("[books/by-user] error stack:", error?.stack);
    return res.status(500).json({
      data: null,
      error: error?.message || "Failed to fetch books"
    });
  }
});

// Public book details
app.get("/api/books/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("[books/:id] fetching book", id);

    const bookClient = ensureModel<any>(prisma, "book");
    const book = await bookClient.findUnique({
      where: { id },
    });

    if (!book) {
      return res.status(404).json({ data: null, error: "Book not found" });
    }

    // Optionally, also fetch profile/author username if available
    // For now, just return the book object.
    return res.json({ data: book, error: null });
  } catch (error: any) {
    console.error("[books/:id] error:", error);
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/books/public/:username", async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username },
    });
    if (!profile) {
      return res.json({ data: [], error: null });
    }
    const bookClient = ensureModel<any>(prisma, "book");
    const books = await bookClient.findMany({
      where: { userId: profile.user_id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: books, error: null });
  } catch (error: any) {
    console.error("Error fetching public books:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to fetch books" });
  }
});

app.patch("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const bookClient = ensureModel<any>(prisma, "book");
    
    // Verify ownership before updating
    const existingBook = await bookClient.findUnique({ where: { id: req.params.id } });
    if (!existingBook || existingBook.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only update your own books" });
    }

    const book = await bookClient.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
      },
    });
    res.json({ data: book, error: null });
  } catch (error: any) {
    console.error("Error updating book:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to update book" });
  }
});

// Global error handler fallback
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err?.message || err);
  res.status(500).json({ data: null, error: err?.message || "Internal server error" });
});

// Subscriptions
app.get("/api/subscriptions", async (req, res) => {
  const subscriberId = String(req.query.subscriberId || "");
  const subscribedToId = String(req.query.subscribedToId || "");
  try {
    if (subscriberId && subscribedToId) {
      const subscription = await prisma.subscription.findUnique({
        where: {
          subscriber_id_subscribed_to_id: {
            subscriber_id: subscriberId,
            subscribed_to_id: subscribedToId,
          },
        },
      });
      res.json({ data: subscription, error: null });
      return;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        subscriber_id: subscriberId || undefined,
        subscribed_to_id: subscribedToId || undefined,
      },
    });
    res.json({ data: subscriptions, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.post("/api/subscriptions", requireAuth, async (req, res) => {
  const { subscribed_to_id } = req.body;
  try {
    // Use authenticated user's ID as subscriber
    const subscription = await prisma.subscription.create({
      data: { subscriber_id: req.user!.id, subscribed_to_id },
    });
    res.json({ data: subscription, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.delete("/api/subscriptions", requireAuth, async (req, res) => {
  const subscribedToId = String(req.query.subscribedToId || "");
  try {
    // Use authenticated user's ID as subscriber
    const subscription = await prisma.subscription.delete({
      where: {
        subscriber_id_subscribed_to_id: {
          subscriber_id: req.user!.id,
          subscribed_to_id: subscribedToId,
        },
      },
    });
    res.json({ data: subscription, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

// Notifications
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    // Use authenticated user's ID
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user!.id },
      orderBy: { created_at: "desc" },
      take: 10,
    });
    res.json({ data: notifications, error: null });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ data: null, error: error?.message || "Failed to fetch notifications" });
  }
});

app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    // Verify ownership before updating
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only mark your own notifications as read" });
    }

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ data: notification, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    // Use authenticated user's ID
    await prisma.notification.updateMany({
      where: { user_id: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ data: true, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
  try {
    // Verify ownership before deleting
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.user_id !== req.user!.id) {
      return res.status(403).json({ error: "You can only delete your own notifications" });
    }

    const notification = await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ data: notification, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error });
  }
});

const startServer = async () => {
  await runBackendDiagnostics().catch((err) =>
    console.error("Diagnostics error:", err?.message || err)
  );

  const PORT = Number(process.env.PORT) || 4001;
  const HOST = process.env.HOST || "0.0.0.0"; // Listen on all interfaces for network access

  try {
    app.listen(PORT, HOST, () => {
      console.log(`API server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
      console.log(`API server accessible on network at http://<your-ip>:${PORT}`);
    });
  } catch (err: any) {
    console.error("Startup failure:", err?.message || err);
  }
};

startServer().catch((err) => {
  console.error("Startup failure:", err?.message || err);
});

