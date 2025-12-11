import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FallbackCover from "./FallbackCover";

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
  | { type: "cover"; image: string | null; title: string }
  | { type: "text"; text: string }
  | { type: "end"; image: string | null };

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
    });

    // 2. Story Pages
    const textPages = (book.pages as string[]) || (book.content ? [book.content] : []);
    textPages.forEach((text) => {
      result.push({ type: "text", text });
    });

    // 3. End Page
    result.push({
      type: "end",
      image: book.endImageUrl || book.coverImageUrl || null,
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
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [open, book, totalPages]);

  if (!book) return null;

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  const currentPage = readerPages[pageIndex];

  const renderContent = () => {
    if (!currentPage) return null;

    if (currentPage.type === "cover") {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-slate-50 p-8 text-center relative overflow-hidden rounded-lg">
          {currentPage.image ? (
            <img
              src={currentPage.image}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900" />
          )}

          <div className="relative z-10 bg-slate-950/80 p-6 rounded-xl border border-slate-800 shadow-2xl max-w-md w-full">
            {currentPage.image ? (
              <img src={currentPage.image} alt="Cover" className="w-full h-64 object-cover rounded-md mb-6 shadow-md" />
            ) : (
              <FallbackCover title={book.title} className="w-full h-64 rounded-md mb-6" />
            )}
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-balance">{book.title}</h1>
            <p className="text-slate-400 text-sm">A Generated Story</p>
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
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950 text-slate-50 relative overflow-hidden rounded-lg">
          {currentPage.image && (
            <img
              src={currentPage.image}
              alt="End"
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
          )}
          <div className="relative z-10 text-center space-y-4 p-8 bg-slate-950/60 backdrop-blur-sm rounded-xl border border-slate-800/50">
            <h2 className="text-5xl font-serif font-bold tracking-widest text-slate-100 drop-shadow-lg">The End</h2>
            <p className="text-slate-300">Thanks for reading</p>
          </div>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col gap-0 p-0 border-slate-800 bg-slate-950">
        <div className="flex-1 overflow-hidden relative bg-slate-900 flex flex-col">
          <div className="flex-1 w-full h-full p-4 md:p-6 flex items-center justify-center">
            <div className="w-full h-full max-w-4xl shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative">
              {renderContent()}
            </div>
          </div>

          {/* Controls Overlay or Bottom Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-400 w-24">
              Page {pageIndex + 1} of {totalPages}
            </span>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={pageIndex === 0}
                className="border-slate-700 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                onClick={goNext}
                disabled={pageIndex === totalPages - 1}
                className="border-slate-700 hover:bg-slate-800 hover:text-white"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="w-24 text-right">
              {/* Placeholder for symmetry */}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookReader;
