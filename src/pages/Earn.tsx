import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, ExternalLink, Link as LinkIcon, Music4, ShoppingBag } from "lucide-react";
import BookReader from "@/components/books/BookReader";
import FallbackCover from "@/components/books/FallbackCover";
import Marketplace from "@/components/Marketplace";
import CustomizedMusicGenerator from "@/components/CustomizedMusicGenerator";
import EarnImagePicker from "@/components/EarnImagePicker";

type Book = {
  id: string;
  title: string;
  description?: string | null;
  content?: string;
  pages?: string[] | null;
  coverImageUrl?: string | null;
  createdAt?: string;
};

type PanelKey = "book" | "marketplace" | "music" | null;

const Earn = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fallbackCover, setFallbackCover] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelKey>("book");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoadingBooks(true);
      const { data, error } = await apiFetch<Book[]>(`/books/by-user/${userId}`);
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
      } else if (data) {
        setBooks(data);
      }
      setLoadingBooks(false);
    };
    load();
  }, [userId]);

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
        description: "Upgrade to unlock more credits, branding, and team seats.",
        icon: ShoppingBag,
      },
      {
        id: "music" as const,
        title: "Customized Music Generator",
        description: "Generate AI music with prompt, duration, and genre control.",
        icon: Music4,
      },
    ],
    []
  );

  const generateBook = async () => {
    if (!userId) {
      toast({ title: "Not signed in", description: "Please log in first", variant: "destructive" });
      return;
    }
    if (!prompt.trim()) {
      toast({ title: "Prompt required", description: "Enter an idea for the book", variant: "destructive" });
      return;
    }
    setGenerating(true);
    const { data, error } = await apiFetch<Book>("/books/generate", {
      method: "POST",
      data: {
        userId,
        prompt,
        title: title || undefined,
        description: description || undefined,
        coverImageData: fallbackCover || undefined,
      },
    });
    setGenerating(false);
    if (error || !data) {
      // Log full error details for debugging
      console.error("[Earn] Book generation error:", {
        error,
        errorType: typeof error,
        errorDetails: typeof error === "object" ? error : null
      });
      
      // Show user-friendly message (don't expose sensitive details)
      const errorMessage = typeof error === "string" 
        ? error 
        : (error?.details && typeof error.details === "string" && !error.details.includes("API key"))
          ? error.details
          : "Please try again";
      
      toast({
        title: "Book generation failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Book generated successfully" });
    setPrompt("");
    setTitle("");
    setDescription("");
    // Refresh books list
    setLoadingBooks(true);
    const { data: refreshedBooks, error: refreshError } = await apiFetch<Book[]>(`/books/by-user/${userId}`);
    if (!refreshError && refreshedBooks) {
      setBooks(refreshedBooks);
    } else {
      // Fallback: add the new book to the list
      const missingCover = !data.coverImageUrl;
      const bookWithFallback = missingCover && fallbackCover ? { ...data, coverImageUrl: fallbackCover } : data;
      if (missingCover && !fallbackCover) {
        toast({
          title: "AI cover unavailable",
          description: "Upload your own image and regenerate to add a cover.",
        });
      }
      setBooks((prev) => [bookWithFallback, ...prev]);
    }
    setLoadingBooks(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-400">Earn</p>
            <h1 className="text-3xl font-bold text-slate-50">Create & Monetize</h1>
            <p className="text-slate-400 mt-1">
              Generate books, upgrade with premium plans, or craft custom music.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {panels.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;
            return (
              <Card
                key={panel.id}
                role="button"
                tabIndex={0}
                onClick={() => setActivePanel((prev) => (prev === panel.id ? null : panel.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActivePanel((prev) => (prev === panel.id ? null : panel.id));
                  }
                }}
                className={`cursor-pointer border-slate-800 bg-slate-900/80 transition-all hover:border-blue-600 ${
                  isActive ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-blue-300" />
                      <p className="font-semibold text-slate-100">{panel.title}</p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                      {isActive ? "Open" : "Tap to open"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400">{panel.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          {activePanel === "book" && (
            <div className="space-y-4">
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
                        className="bg-slate-950 border-slate-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">Short description (optional)</label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a short tagline or summary"
                        className="bg-slate-950 border-slate-800"
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
                      className="bg-slate-950 border-slate-800"
                    />
                  </div>

                  <EarnImagePicker
                    label="Upload your own image"
                    helperText="If AI cover art fails, we will use your uploaded image instead."
                    onChange={(img) => setFallbackCover(img)}
                  />

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

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Your books</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingBooks ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : books.length === 0 ? (
                    <div className="text-slate-400 text-sm">No books yet. Start by generating your first one!</div>
                  ) : (
                    <div className="space-y-3">
                      {books.map((book) => (
                        <div
                          key={book.id}
                          className="w-full text-left p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBook(book);
                            setIsReaderOpen(true);
                          }}
                        >
                          <div className="flex items-start gap-3">
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
                              <div className="flex items-center justify-between mt-2">
                                {book.pages && Array.isArray(book.pages) && (
                                  <p className="text-xs text-slate-500">
                                    {book.pages.length} page{book.pages.length === 1 ? "" : "s"}
                                  </p>
                                )}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-blue-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const baseUrl = window.location.origin;
                                      const url = `${baseUrl}/books/${book.id}`;
                                      navigator.clipboard
                                        .writeText(url)
                                        .then(() => {
                                          toast({
                                            title: "Link copied",
                                            description: "Public book link copied to clipboard.",
                                          });
                                        })
                                        .catch(() => {
                                          toast({
                                            title: "Failed to copy",
                                            description: "Could not copy link to clipboard.",
                                            variant: "destructive",
                                          });
                                        });
                                    }}
                                  >
                                    <LinkIcon className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-blue-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const baseUrl = window.location.origin;
                                      const url = `${baseUrl}/books/${book.id}`;
                                      window.open(url, "_blank");
                                    }}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activePanel === "marketplace" && <Marketplace />}

          {activePanel === "music" && <CustomizedMusicGenerator />}
        </div>
      </div>

      <BookReader
        book={selectedBook}
        open={isReaderOpen}
        onOpenChange={(open) => {
          setIsReaderOpen(open);
          if (!open) setSelectedBook(null);
        }}
      />
    </div>
  );
};

export default Earn;

