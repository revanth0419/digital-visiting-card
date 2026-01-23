import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FallbackCover from "@/components/books/FallbackCover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, BookOpen } from "lucide-react";
import dvcLogo from "@/assets/branding/dvc-logo-circle.png";

interface Chapter {
  type: string;
  title: string;
  content: string;
  image?: string | null;
}

interface Book {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  pages?: string[] | null;
  coverImageUrl?: string | null;
  endImageUrl?: string | null;
  createdAt: string;
}

const PublicBook = () => {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadBook = async () => {
      if (!id) {
        setError("Book ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("books")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) {
          console.error("Error fetching book:", fetchError);
          setError("This book could not be found.");
          return;
        }

        if (!data) {
          setError("Book not found.");
          return;
        }

        setBook({
          id: data.id,
          title: data.title,
          description: data.description,
          content: data.content,
          pages: data.pages as string[] | null,
          coverImageUrl: data.cover_image_url,
          endImageUrl: data.end_image_url,
          createdAt: data.created_at,
        });
        setPageIndex(0);
        setImageError(false);
      } catch (err) {
        console.error("[PublicBook] error:", err);
        setError("Unable to load this book.");
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id]);

  // Parse pages/chapters
  const parsePages = (): { type: string; title?: string; content: string; image?: string | null }[] => {
    if (!book) return [];

    const result: { type: string; title?: string; content: string; image?: string | null }[] = [];

    // Add cover page
    result.push({
      type: "cover",
      content: book.title,
      image: book.coverImageUrl
    });

    // Parse stored pages
    if (book.pages && Array.isArray(book.pages)) {
      for (const page of book.pages) {
        try {
          const parsed = typeof page === 'string' ? JSON.parse(page) : page;
          if (parsed.type === 'chapter') {
            result.push({
              type: "chapter",
              title: parsed.title,
              content: parsed.content,
              image: parsed.image
            });
          } else {
            result.push({
              type: "text",
              content: String(page)
            });
          }
        } catch {
          result.push({
            type: "text",
            content: String(page)
          });
        }
      }
    } else if (book.content) {
      // Fallback to raw content
      try {
        const parsed = JSON.parse(book.content);
        if (parsed.chapters) {
          for (const ch of parsed.chapters) {
            result.push({
              type: "chapter",
              title: ch.title,
              content: ch.content,
              image: ch.image
            });
          }
        }
      } catch {
        result.push({
          type: "text",
          content: book.content
        });
      }
    }

    // Add end page
    result.push({
      type: "end",
      content: "The End",
      image: book.endImageUrl || book.coverImageUrl
    });

    return result;
  };

  const pages = parsePages();
  const totalPages = pages.length;
  const currentPage = pages[pageIndex];

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [totalPages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50 gap-4">
        <BookOpen className="w-16 h-16 text-slate-600 mb-2" />
        <p className="text-slate-400 text-lg">{error || "Book not found."}</p>
        <Link to="/">
          <Button variant="outline" size="sm">Go home</Button>
        </Link>
      </div>
    );
  }

  const renderPage = () => {
    if (!currentPage) return null;

    if (currentPage.type === "cover") {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-slate-900 via-indigo-900/50 to-slate-900 p-8 text-center relative overflow-hidden">
          {currentPage.image && !imageError ? (
            <img
              src={currentPage.image}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
              onError={() => setImageError(true)}
            />
          ) : null}

          <div className="relative z-10 bg-slate-950/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full">
            {currentPage.image && !imageError ? (
              <img
                src={currentPage.image}
                alt="Cover"
                className="w-full h-72 object-cover rounded-xl mb-6 shadow-lg"
                onError={() => setImageError(true)}
              />
            ) : (
              <FallbackCover title={book.title} className="w-full h-72 rounded-xl mb-6" />
            )}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-white">{book.title}</h1>
            {book.description && (
              <p className="text-slate-400 text-sm line-clamp-3">{book.description}</p>
            )}
          </div>
        </div>
      );
    }

    if (currentPage.type === "chapter") {
      return (
        <div className="h-full w-full bg-[#faf9f6] text-slate-900 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 md:p-10">
            {currentPage.image && (
              <img
                src={currentPage.image}
                alt={currentPage.title}
                className="w-full h-48 md:h-64 object-cover rounded-xl mb-6 shadow-md"
              />
            )}
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-6 text-slate-800 border-b border-slate-200 pb-4">
              {currentPage.title}
            </h2>
            <div className="prose prose-lg max-w-none font-serif leading-relaxed text-slate-700">
              {currentPage.content.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-4">{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (currentPage.type === "text") {
      return (
        <div className="h-full w-full bg-[#faf9f6] text-slate-900 p-8 md:p-12 overflow-y-auto">
          <div className="prose prose-lg max-w-3xl mx-auto font-serif leading-relaxed">
            <p className="whitespace-pre-line">{currentPage.content}</p>
          </div>
        </div>
      );
    }

    if (currentPage.type === "end") {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 relative overflow-hidden">
          {currentPage.image && (
            <img
              src={currentPage.image}
              alt="End"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative z-10 text-center space-y-6 p-8 bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-slate-800/50">
            <h2 className="text-5xl md:text-6xl font-serif font-bold tracking-widest text-white drop-shadow-lg">
              The End
            </h2>
            <p className="text-slate-300 text-lg">Thank you for reading</p>
            <p className="text-slate-500 text-sm">{book.title}</p>
          </div>
        </div>
      );
    }

    return null;
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={dvcLogo} alt="Digital Visiting Card Logo" className="object-contain bg-black rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.35)] w-[34px] h-[34px] md:w-[40px] md:h-[40px]" />
            <h1 className="text-2xl font-bold text-gradient">Digital Visiting Card</h1>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          {/* Book Content */}
          <div className="h-[60vh] md:h-[70vh] overflow-hidden rounded-t-xl">
            {renderPage()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 border-t border-slate-800 p-4 bg-slate-950">
            <span className="text-sm text-slate-500 font-medium min-w-[80px]">
              {pageIndex + 1} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={pageIndex === 0}
                className="gap-1 border-slate-700 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={goNext}
                disabled={pageIndex === totalPages - 1}
                className="gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="min-w-[80px] text-right">
              <span className="text-xs text-slate-600">Use ← → keys</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicBook;
