import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Link = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  order_index: number;
  product_image_url: string | null;
  show_in_shop: boolean;
  show_in_links: boolean;
  price: string | null;
};

type LinksManagerProps = {
  userId: string;
};

const SortableLink = ({
  link,
  onDelete,
}: {
  link: Link;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 glass-card border rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      {link.product_image_url && (
        <img
          src={link.product_image_url}
          alt={link.title}
          className="w-12 h-12 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {link.icon && <span>{link.icon}</span>}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{link.title}</p>
            <p className="text-xs text-muted-foreground truncate">{link.url}</p>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(link.id)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

const LinksManager = ({ userId }: LinksManagerProps) => {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPrice, setPreviewPrice] = useState<string | null>(null);
  const [isShoppingLink, setIsShoppingLink] = useState(false);
  const [showInLinks, setShowInLinks] = useState(true);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout>();

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchLinks();
  }, [userId]);

  const fetchLinks = async () => {
    try {
      setLoading(true);

      // Get links directly using userId
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("user_id", userId)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Failed to fetch links:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load links.",
          variant: "destructive",
        });
        setLinks([]);
      } else {
        setLinks(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching links:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const normalizeUrl = (url: string): string => {
    if (url.trim().startsWith("www.")) {
      return `https://${url.trim()}`;
    }
    return url.trim();
  };

  const validateUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const fetchLinkMetadata = async (url: string) => {
    setFetchingMetadata(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
        body: { url },
      });

      if (error) {
        console.error('Error fetching metadata:', error);
        toast({
          title: "Couldn't fetch preview",
          description: "Unable to load product image. You can still add the link.",
          variant: "default",
        });
        return { imageUrl: null, title: null, price: null };
      }

      if (data?.imageUrl) {
        toast({
          title: "Preview loaded!",
          description: "Product image fetched successfully.",
        });
      }

      return data || { imageUrl: null, title: null, price: null };
    } catch (error) {
      logger.error('Error fetching metadata:', error);
      return { imageUrl: null, title: null, price: null };
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleUrlChange = async (url: string) => {
    setNewUrl(url);
    setPreviewImage(null);
    setPreviewPrice(null);

    const normalizedUrl = normalizeUrl(url);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (validateUrl(normalizedUrl)) {
      debounceTimer.current = setTimeout(async () => {
        const metadata = await fetchLinkMetadata(normalizedUrl);
        if (metadata.imageUrl) {
          setPreviewImage(metadata.imageUrl);
        }
        if (metadata.title && !newTitle) {
          setNewTitle(metadata.title);
        }
        if (metadata.price) {
          setPreviewPrice(metadata.price);
        }
      }, 500);
    }
  };

  const handleAddLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and URL are required.",
        variant: "destructive",
      });
      return;
    }

    const normalizedUrl = normalizeUrl(newUrl);

    if (!validateUrl(normalizedUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL (e.g., https://example.com or www.example.com).",
        variant: "destructive",
      });
      return;
    }

    if (normalizedUrl.length > 500) {
      toast({
        title: "URL too long",
        description: "URL must be less than 500 characters.",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);

    try {
      const { error } = await supabase.from("links").insert({
        user_id: userId,
        title: newTitle,
        url: normalizedUrl,
        icon: newIcon || null,
        show_in_shop: isShoppingLink,
        show_in_links: showInLinks,
        product_image_url: manualImageUrl || previewImage,
      });

      if (error) throw error;

      toast({
        title: "Link added!",
        description: "Your new link has been created.",
      });

      setNewTitle("");
      setNewUrl("");
      setNewIcon("");
      setPreviewImage(null);
      setPreviewPrice(null);
      setIsShoppingLink(false);
      setShowInLinks(true);
      setManualImageUrl("");
      fetchLinks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      const { error } = await supabase.from("links").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Link deleted",
        description: "The link has been removed.",
      });
      fetchLinks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = links.findIndex((link) => link.id === active.id);
    const newIndex = links.findIndex((link) => link.id === over.id);

    const newLinks = arrayMove(links, oldIndex, newIndex);
    setLinks(newLinks);

    // Update order in database
    for (let i = 0; i < newLinks.length; i++) {
      // We catch error individually to not break the entire loop
      const { error } = await supabase
        .from("links")
        .update({ order_index: i })
        .eq("id", newLinks[i].id);

      if (error) console.error("Error updating order:", error);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-2">
      <CardHeader>
        <CardTitle>Links</CardTitle>
        <CardDescription>Manage your profile links</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Link Form */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="My Awesome Link"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={newUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com or www.example.com"
            />
            {fetchingMetadata && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching preview...
              </p>
            )}
            {previewImage && (
              <div className="mt-2 p-3 border rounded-lg bg-background/50 space-y-2">
                <p className="text-xs text-muted-foreground">Product Preview:</p>
                <img
                  src={previewImage}
                  alt="Link preview"
                  className="w-24 h-24 object-cover rounded"
                />
                {previewPrice && (
                  <p className="text-sm font-semibold text-primary">{previewPrice}</p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manualImageUrl">Product Image URL (optional)</Label>
            <Input
              id="manualImageUrl"
              value={manualImageUrl}
              onChange={(e) => setManualImageUrl(e.target.value)}
              placeholder="https://example.com/product-image.jpg"
            />
            <p className="text-xs text-muted-foreground">
              If automatic preview fails, paste the direct product image URL here
            </p>
            {manualImageUrl && (
              <div className="mt-2 p-3 border rounded-lg bg-background/50 space-y-2">
                <p className="text-xs text-muted-foreground">Manual Image Preview:</p>
                <img
                  src={manualImageUrl}
                  alt="Manual preview"
                  className="w-24 h-24 object-cover rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="icon">Icon (emoji, optional)</Label>
            <Input
              id="icon"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="🔗"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showInLinks"
                checked={showInLinks}
                onChange={(e) => setShowInLinks(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <Label htmlFor="showInLinks" className="cursor-pointer">
                Show in Links section
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isShoppingLink"
                checked={isShoppingLink}
                onChange={(e) => setIsShoppingLink(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <Label htmlFor="isShoppingLink" className="cursor-pointer">
                Show in Shop section
              </Label>
            </div>
          </div>
          <Button
            onClick={handleAddLink}
            disabled={adding}
            variant="gradient"
            className="w-full"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </>
            )}
          </Button>
        </div>

        {/* Links List */}
        {links.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {links.map((link) => (
                  <SortableLink key={link.id} link={link} onDelete={handleDeleteLink} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-medium mb-1">No links yet</p>
            <p className="text-sm">Click "Add Link" above to get started sharing your content!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LinksManager;
