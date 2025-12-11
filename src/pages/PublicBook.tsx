import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import FallbackCover from "@/components/books/FallbackCover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Book {
  id: string;
  title: string;
  description: string;
  content: string;
  pages?: string[] | null;
  coverImageUrl?: string | null;
  createdAt: string | Date;
}

const PublicBook = () => {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await apiFetch<Book>(`/books/${id}`);
        
        if (response.error || !response.data) {
          setError(response.error || "Unable to load this book.");
          return;
        }
        
        setBook(response.data);
        setPageIndex(0);
        setImageError(false);
      } catch (err: any) {
        console.error("[PublicBook] error:", err);
        setError("Unable to load this book.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
        <p className="text-red-400 text-sm">{error || "Book not found."}</p>
        <Link to="/">
          <Button variant="outline" size="sm">Go home</Button>
        </Link>
      </div>
    );
  }

  const pages = (book.pages as string[] | undefined) ?? [book.content || ""];
  const totalPages = pages.length;
  const currentPage = pages[pageIndex] || "";

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setPageIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setPageIndex((i) => Math.min(totalPages - 1, i + 1));
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [totalPages]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-bold text-lg text-gradient">Prism Link Spot</span>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">Log in</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl p-4 md:p-6 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <div className="w-full md:w-52 h-64 flex-shrink-0">
              {book.coverImageUrl && !imageError ? (
                <img
                  src={book.coverImageUrl}
                  alt={book.title}
                  className="w-full h-full object-cover rounded-xl"
                  onError={() => setImageError(true)}
                />
              ) : (
                <FallbackCover title={book.title} className="w-full h-full rounded-xl" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold">{book.title}</h1>
              <p className="text-xs text-slate-500">
                {new Date(book.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400 line-clamp-4">
                {book.description}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-6 h-[50vh] md:h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-line leading-relaxed text-sm md:text-base text-slate-200">
              {currentPage}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500 font-medium">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={pageIndex === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={goNext}
                disabled={pageIndex === totalPages - 1}
                className="gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicBook;

