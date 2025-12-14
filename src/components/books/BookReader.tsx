import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import FallbackCover from "./FallbackCover";

interface Chapter {
  type: string;
  title: string;
  content: string;
  image?: string | null;
}

interface Book {
  id: string;
  title: string;
  description?: string | null;
  pages?: string[] | null;
  content?: string;
  coverImageUrl?: string | null;
  endImageUrl?: string | null;
  createdAt?: string | Date;
}

interface BookReaderProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Page =
  | { type: "cover"; image: string | null; title: string; description?: string | null }
  | { type: "chapter"; title: string; content: string; image?: string | null }
  | { type: "text"; text: string }
  | { type: "end"; image: string | null; title: string };

const BookReader: React.FC<BookReaderProps> = ({ book, open, onOpenChange }) => {
  const [pageIndex, setPageIndex] = useState(0);

  // Construct page sequence
  const readerPages: Page[] = useMemo(() => {
    if (!book) return [];

    const result: Page[] = [];

    // 1. Cover Page
    result.push({
      type: "cover",
      image: book.coverImageUrl || null,
      title: book.title,
      description: book.description,
    });

    // 2. Parse stored pages
    if (book.pages && Array.isArray(book.pages)) {
      for (const page of book.pages) {
        try {
          const parsed = typeof page === 'string' ? JSON.parse(page) : page;
          if (parsed.type === 'chapter') {
            result.push({
              type: "chapter",
              title: parsed.title,
              content: parsed.content,
              image: parsed.image || null
            });
          } else {
            result.push({ type: "text", text: String(page) });
          }
        } catch {
          result.push({ type: "text", text: String(page) });
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
              image: ch.image || null
            });
          }
        }
      } catch {
        result.push({ type: "text", text: book.content });
      }
    }

    // 3. End Page
    result.push({
      type: "end",
      image: book.endImageUrl || book.coverImageUrl || null,
      title: book.title,
    });

    return result;
  }, [book]);

  const totalPages = readerPages.length;

  useEffect(() => {
    if (open) {
      setPageIndex(0);
    }
  }, [open, book?.id]);

  useEffect(() => {
    if (!open || !book) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setPageIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setPageIndex((i) => Math.min(totalPages - 1, i + 1));
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [open, book, totalPages, onOpenChange]);

  if (!book) return null;

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  const currentPage = readerPages[pageIndex];

  const renderContent = () => {
    if (!currentPage) return null;

    if (currentPage.type === "cover") {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-slate-900 via-indigo-900/50 to-slate-900 p-8 text-center relative overflow-hidden rounded-lg">
          {currentPage.image ? (
            <img
              src={currentPage.image}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900" />
          )}

          <div className="relative z-10 bg-slate-950/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full">
            {currentPage.image ? (
              <img src={currentPage.image} alt="Cover" className="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" />
            ) : (
              <FallbackCover title={book.title} className="w-full h-64 rounded-xl mb-6" />
            )}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-white">{currentPage.title}</h1>
            {currentPage.description && (
              <p className="text-slate-400 text-sm line-clamp-2">{currentPage.description}</p>
            )}
          </div>
        </div>
      );
    }

    if (currentPage.type === "chapter") {
      return (
        <div className="h-full w-full bg-[#faf9f6] text-slate-900 overflow-y-auto rounded-lg">
          <div className="max-w-3xl mx-auto p-6 md:p-10">
            {currentPage.image && (
              <img 
                src={currentPage.image} 
                alt={currentPage.title} 
                className="w-full h-48 md:h-56 object-cover rounded-xl mb-6 shadow-md"
              />
            )}
            <h2 className="text-xl md:text-2xl font-serif font-bold mb-6 text-slate-800 border-b border-slate-200 pb-4">
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
        <div className="h-full w-full bg-[#faf9f6] text-slate-900 p-8 md:p-12 overflow-y-auto font-serif text-lg leading-relaxed rounded-lg shadow-inner">
          <p className="whitespace-pre-line max-w-prose mx-auto">{currentPage.text}</p>
        </div>
      );
    }

    if (currentPage.type === "end") {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 relative overflow-hidden rounded-lg">
          {currentPage.image && (
            <img
              src={currentPage.image}
              alt="End"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative z-10 text-center space-y-4 p-8 bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-slate-800/50">
            <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-widest text-white drop-shadow-lg">The End</h2>
            <p className="text-slate-300">Thanks for reading</p>
            <p className="text-slate-500 text-sm">{currentPage.title}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col gap-0 p-0 border-slate-800 bg-slate-950">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="flex-1 overflow-hidden relative bg-slate-900 flex flex-col">
          <div className="flex-1 w-full h-full p-4 md:p-6 flex items-center justify-center">
            <div className="w-full h-full max-w-4xl shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative">
              {renderContent()}
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-400 w-24">
              {pageIndex + 1} / {totalPages}
            </span>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={pageIndex === 0}
                className="border-slate-700 hover:bg-slate-800 hover:text-white gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <Button
                variant="outline"
                onClick={goNext}
                disabled={pageIndex === totalPages - 1}
                className="border-slate-700 hover:bg-slate-800 hover:text-white gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-24 text-right text-xs text-slate-600">
              ← → keys
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookReader;
