import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Book = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
};

interface EarnSectionProps {
  userId: string;
}

const EarnSection = ({ userId }: EarnSectionProps) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchBooks = async () => {
    setLoadingList(true);
    const { data, error } = await apiFetch<Book[]>(`/books/by-user/${userId}`);
    if (error) {
      toast({
        title: "Error",
        description: error?.message || error || "Failed to load books",
        variant: "destructive",
      });
    } else if (data) {
      setBooks(data);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    fetchBooks();
  }, [userId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt required", description: "Please enter a prompt.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await apiFetch<Book>("/books/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: prompt.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        userId,
      }),
    });
    setLoading(false);
    if (error || !data) {
      toast({
        title: "Error",
        description: error?.message || error || "Failed to generate book",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Book generated successfully!" });
    setPrompt("");
    setTitle("");
    setDescription("");
    setBooks((prev) => [data, ...prev]);
  };

  const togglePublish = async (book: Book, isPublished: boolean) => {
    // Publishing feature removed - books are always published
    toast({
      title: "Info",
      description: "Books are automatically published",
    });
  };

  return (
    <Card className="glass-card border-2">
      <CardHeader>
        <CardTitle>AI Book Creator (Earn Section)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Book idea / prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the book you want to generate..."
          />
        </div>
        <div className="space-y-2">
          <Label>Book title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional custom title" />
        </div>
        <div className="space-y-2">
          <Label>Short description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short tagline or summary"
          />
        </div>
        <Button onClick={handleGenerate} disabled={loading} variant="gradient" className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Book"
          )}
        </Button>

        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Your Books</h3>
            {loadingList && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {books.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books yet. Generate one to get started.</p>
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
                <div key={book.id} className="p-3 border rounded-lg bg-muted/40 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{book.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {book.description || "No description"} · {new Date(book.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Published</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EarnSection;

