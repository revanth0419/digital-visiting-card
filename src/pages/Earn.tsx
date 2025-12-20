import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  BookOpen,
  ExternalLink,
  Link as LinkIcon,
  Music4,
  ShoppingBag,
  Eye,
  EyeOff,
} from "lucide-react";
import BookReader from "@/components/books/BookReader";
import FallbackCover from "@/components/books/FallbackCover";
import Marketplace from "@/components/Marketplace";
import SunoMusicGenerator from "@/components/SunoMusicGenerator";
import EarnImagePicker from "@/components/EarnImagePicker";

/* ---------------- TYPES ---------------- */

type Book = {
  id: string;
  title: string;
  description?: string | null;

  coverImageUrl?: string | null;
  endImageUrl?: string | null;

  createdAt?: string;          // ✅ OPTIONAL
  show_on_profile?: boolean;

  // Loaded only when opening reader
  pages?: string[] | null;
  content?: string | null;
};


type PanelKey = "book" | "marketplace" | "music" | null;

/* ---------------- COMPONENT ---------------- */

const Earn = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fallbackCover, setFallbackCover] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelKey>("book");
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null);

  /* ---------------- AUTH ---------------- */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  /* ---------------- LOAD BOOKS (SAFE QUERY) ---------------- */

  useEffect(() => {
    if (!userId) return;

    const loadBooks = async () => {
      setLoadingBooks(true);

      const { data, error } = await supabase
        .from("books")
        .select(
          `
          id,
          title,
          description,
          cover_image_url,
          end_image_url,
          created_at,
          show_on_profile
        `
        )
        .order("created_at", { ascending: false });

      type BookRow = {
        id: string;
        title: string;
        description: string | null;
        cover_image_url: string | null;
        end_image_url: string | null;
        created_at: string;
        show_on_profile: boolean | null;
        pages: string[] | null;
        content: string | null;
      };

      if (error) {
        console.error("Error loading books:", error);
        toast({
          title: "Error",
          description: `Failed to load books: ${error.message || error.details || "Unknown error"}`,
          variant: "destructive",
        });
      } else if (data) {
        const booksData = data as BookRow[];
        setBooks(
          booksData.map((b) => ({
            id: b.id,
            title: b.title,
            description: b.description,
            coverImageUrl: b.cover_image_url,
            endImageUrl: b.end_image_url,
            createdAt: b.created_at,
            show_on_profile: b.show_on_profile ?? true,
            pages: b.pages,
            content: b.content
          }))
        );
      }

      setLoadingBooks(false);
    };

    loadBooks();
  }, [userId, toast]);

  /* ---------------- OPEN BOOK (LAZY LOAD) ---------------- */

  const handleOpenBook = async (book: Book) => {
    if (loadingBookId) return;

    // If already loaded, just open
    if (book.pages || book.content) {
      setSelectedBook(book);
      setIsReaderOpen(true);
      return;
    }

    setLoadingBookId(book.id);
    try {
      const { data, error } = await supabase
        .from("books")
        .select("pages, content")
        .eq("id", book.id)
        .single();

      if (error) throw error;

      const fullBook = { ...book, pages: data.pages as any, content: data.content };

      // Update local books state so it's cached
      setBooks(prev => prev.map(b => b.id === book.id ? fullBook : b));

      setSelectedBook(fullBook);
      setIsReaderOpen(true);
    } catch (err: any) {
      console.error("Error loading book details:", err);
      toast({
        title: "Error",
        description: "Failed to load book content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingBookId(null);
    }
  };

  /* ---------------- GENERATE BOOK ---------------- */

  const generateBook = async () => {
    if (!userId) {
      toast({ title: "Please log in first", variant: "destructive" });
      return;
    }

    if (prompt.trim().length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please enter at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      // 1. Get current session for explicit auth header (Fixes 402/Auth errors)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.access_token) {
        throw new Error("Authentication credential missing. Please log in again.");
      }

      // 2. Prepare lightweight payload (Strictly text only)
      const payload = {
        prompt,
        title: title || undefined,
        description: description || undefined,
      };

      // 3. Raw fetch to Supabase Edge Function
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-book`;
      console.log("Generatng book via:", functionUrl);

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 4. Handle non-2xx failures robustly
      if (!response.ok) {
        let errorMessage = `Server error ${response.status}`;
        try {
          const errorJson = await response.json();
          if (errorJson.error) errorMessage = errorJson.error;
        } catch (e) {
          // fallback to status text if json parse fails
        }
        throw new Error(errorMessage);
      }

      // 5. Success
      const data = await response.json();

      // Handle "Always 200" error responses
      if (data.ok === false) {
        throw new Error(data.error || "Unknown generation error");
      }

      console.log("Book generated:", data);

      toast({ title: "Book generated successfully!" });

      // Reset form
      setPrompt("");
      setTitle("");
      setDescription("");
      setFallbackCover(null);
      setEndImage(null);

      // Reload to show new book
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err: any) {
      console.error("Book generation error:", err);
      toast({
        title: "Book generation failed",
        description: err.message ?? "Please try again later",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  /* ---------------- PANELS ---------------- */

  const panels = useMemo(
    () => [
      {
        id: "book" as const,
        title: "Customized Book Generator",
        description: "Turn your ideas into mini-books with AI covers and pages.",
        icon: BookOpen,
      },
      {
        id: "marketplace" as const,
        title: "Marketplace Plans",
        description: "Upgrade to unlock more credits and features.",
        icon: ShoppingBag,
      },
      {
        id: "music" as const,
        title: "Customized Music Generator",
        description: "Generate AI music with prompt and genre control.",
        icon: Music4,
      },
    ],
    []
  );

  /* ---------------- RENDER ---------------- */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header>
          <p className="text-sm text-slate-400">Earn</p>
          <h1 className="text-3xl font-bold">Create & Monetize</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {panels.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;
            return (
              <Card
                key={panel.id}
                onClick={() =>
                  setActivePanel((p) => (p === panel.id ? null : panel.id))
                }
                className={`cursor-pointer bg-slate-900 border-slate-800 ${isActive ? "ring-2 ring-blue-500" : ""
                  }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <p className="font-semibold">{panel.title}</p>
                  </div>
                  <p className="text-sm text-slate-400">{panel.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          {(!activePanel || activePanel === "book") && (
            <>
              {/* Always Visible Book Generator */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Customized Book Generator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">Book title (optional)</label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Crystal Link"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">Short description (optional)</label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a short tagline or summary"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Book idea / prompt</label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      placeholder="Describe the story you want to generate..."
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <EarnImagePicker
                      label="Cover Image"
                      helperText="Upload a custom cover image (optional)."
                      storageKey="book-cover-img"
                      onChange={(img) => setFallbackCover(img)}
                    />
                    <EarnImagePicker
                      label="End Page Image"
                      helperText="Image for the 'The End' page (optional)."
                      storageKey="book-end-img"
                      onChange={(img) => setEndImage(img)}
                    />
                  </div>

                  <Button
                    onClick={generateBook}
                    disabled={generating}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Book"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Always Visible Book List */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Your books</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBooks ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : books.length === 0 ? (
                    <div className="text-slate-400 text-sm">
                      No books yet. Start by generating your first one!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {books.map((book) => (
                        <div
                          key={book.id}
                          className="w-full text-left p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBook(book);
                          }}
                        >
                          <div className="flex items-start gap-4">
                            {loadingBookId === book.id && (
                              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                              </div>
                            )}
                            <div className="w-16 h-20 flex-shrink-0">
                              {book.coverImageUrl ? (
                                <img
                                  src={book.coverImageUrl}
                                  alt={book.title}
                                  className="w-full h-full object-cover rounded-md"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <FallbackCover title={book.title} className="w-full h-full rounded-md" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                <p className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors line-clamp-1">
                                  {book.title}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 mb-2">
                                {book.createdAt ? new Date(book.createdAt).toLocaleString() : "Recently generated"}
                              </p>
                              <p className="text-xs text-slate-400 line-clamp-2">
                                {book.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Optional Panels */}
          {activePanel === "music" && <SunoMusicGenerator />}
          {activePanel === "marketplace" && <Marketplace />}
        </div>
      </div>

      <BookReader
        book={selectedBook}
        open={isReaderOpen}
        onOpenChange={setIsReaderOpen}
      />
    </div>
  );
};

export default Earn;
