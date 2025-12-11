import { useState, useEffect } from "react";
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
  createdAt?: string | Date;
}

interface BookReaderProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BookReader: React.FC<BookReaderProps> = ({ book, open, onOpenChange }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Compute pages and totalPages safely (even if book is null)
  const pages = book ? ((book.pages as string[] | undefined) ?? [book.content || ""]) : [];
  const totalPages = pages.length;

  // Reset to first page when book changes
  useEffect(() => {
    if (book) {
      setPageIndex(0);
      setImageError(false);
    }
  }, [book]);

  // Keyboard navigation - all hooks must be defined before any conditional returns
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

  // Now safe to return early after all hooks are defined
  if (!book) return null;

  const currentPage = pages[pageIndex] || "";
  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-4 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex flex-col gap-2">
            <span className="text-2xl font-bold">{book.title}</span>
            <span className="text-xs text-muted-foreground">
              {book.createdAt ? new Date(book.createdAt).toLocaleString() : "Recently created"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 px-6 pb-4">
          <div className="w-full h-64 rounded-xl overflow-hidden bg-muted flex items-center justify-center shadow-lg">
            {book.coverImageUrl && !imageError ? (
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={() => {
                  setImageError(true);
                }}
              />
            ) : (
              <FallbackCover title={book.title} className="w-full h-full" />
            )}
          </div>

          <div className="flex-1 rounded-xl bg-background/80 border-2 p-6 overflow-y-auto shadow-inner">
            <p className="whitespace-pre-line leading-relaxed text-base md:text-lg text-foreground/90">
              {currentPage}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 pb-6 border-t pt-4 bg-muted/30">
          <span className="text-sm text-muted-foreground font-medium">
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
      </DialogContent>
    </Dialog>
  );
};

export default BookReader;

