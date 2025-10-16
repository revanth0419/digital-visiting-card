import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  const [profileId, setProfileId] = useState("");

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("");

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
    // Get profile ID first
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!profileData) {
      setLoading(false);
      return;
    }

    setProfileId(profileData.id);

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("profile_id", profileData.id)
      .order("order_index");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load links.",
        variant: "destructive",
      });
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  const normalizeUrl = (url: string): string => {
    // If URL starts with www., add https://
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

  const handleAddLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and URL are required.",
        variant: "destructive",
      });
      return;
    }

    // Normalize URL (add https:// to www. URLs)
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

    const { error } = await supabase.from("links").insert({
      profile_id: profileId,
      title: newTitle,
      url: normalizedUrl,
      icon: newIcon || null,
      order_index: links.length,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Link added!",
        description: "Your new link has been created.",
      });
      setNewTitle("");
      setNewUrl("");
      setNewIcon("");
      fetchLinks();
    }

    setAdding(false);
  };

  const handleDeleteLink = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Link deleted",
        description: "The link has been removed.",
      });
      fetchLinks();
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
    const updates = newLinks.map((link, index) => ({
      id: link.id,
      order_index: index,
    }));

    for (const update of updates) {
      await supabase
        .from("links")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
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
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com or www.example.com"
            />
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
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-2">
              Drag to reorder your links
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={links} strategy={verticalListSortingStrategy}>
                {links.map((link) => (
                  <SortableLink key={link.id} link={link} onDelete={handleDeleteLink} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No links yet. Add your first link above!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LinksManager;
