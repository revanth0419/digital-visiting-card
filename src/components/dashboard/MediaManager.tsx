import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadRateLimiter } from "@/lib/rate-limit";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Image as ImageIcon, Video, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MediaManagerProps = {
  userId: string;
};

type Media = {
  id: string;
  type: "image" | "video";
  url: string;
  title: string;
  description: string | null;
  order_index: number;
};

const MediaManager = ({ userId }: MediaManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [signedMediaUrls, setSignedMediaUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMedia();
  }, [userId]);

  const getSignedUrl = async (bucket: string, path: string) => {
    if (!path) return "";
    try {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || "";
    } catch {
      return "";
    }
  };

  const fetchMedia = async () => {
    try {
      // Get media directly with userId
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .eq("user_id", userId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setMedia((data as Media[]) || []);

      // Generate signed URLs for all media
      const urls: Record<string, string> = {};
      if (data) {
        for (const item of data) {
          const signedUrl = await getSignedUrl('media', item.url);
          if (signedUrl) {
            urls[item.id] = signedUrl;
          }
        }
        setSignedMediaUrls(urls);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { allowed, retryAfter } = uploadRateLimiter.checkLimit();
    if (!allowed) {
      toast({
        title: "Upload limit reached",
        description: `Please wait ${retryAfter} seconds before uploading again.`,
        variant: "destructive",
      });
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({
        title: "Invalid file",
        description: "Please upload an image (JPG, PNG, WEBP) or video (MP4)",
        variant: "destructive",
      });
      return;
    }

    const maxSize = isVideo ? 52428800 : 5242880;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Please upload ${isVideo ? 'a video smaller than 50MB' : 'an image smaller than 5MB'}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
  };

  const handleSaveMedia = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your media",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      uploadRateLimiter.recordAttempt();

      const isImage = selectedFile.type.startsWith('image/');
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('media') // Ensure bucket is 'media'
        .upload(filePath, selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(95);

      if (uploadError) throw uploadError;

      // Add to database directly
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("media").insert({
        user_id: userId,
        type: isImage ? 'image' : 'video',
        url: filePath, // Using filePath as we use signed URLs or path for retrieval
        title: title.trim(),
        description: description.trim() || null,
        order_index: media.length,
      });

      if (insertError) throw new Error(insertError.message);

      setUploadProgress(100);

      toast({
        title: "Success",
        description: "Media uploaded successfully!",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchMedia();
    } catch (error: any) {
      toast({
        title: "Error uploading media",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setTitle("");
    setDescription("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (mediaItem: Media) => {
    try {
      // Delete from storage
      await supabase.storage.from('media').remove([mediaItem.url]);

      // Delete from database
      const { error } = await supabase.from("media").delete().eq("id", mediaItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Media deleted successfully!",
      });

      await fetchMedia();
    } catch (error: any) {
      toast({
        title: "Error deleting media",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openLightbox = (url: string, type: "image" | "video") => {
    setLightboxUrl(url);
    setLightboxType(type);
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Media Gallery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Form */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            {previewUrl && (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                {selectedFile?.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    className="w-full h-48 object-cover"
                    controls
                  />
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={handleCancelUpload}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor="media-title">Title *</Label>
              <Input
                id="media-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter media title"
                disabled={uploading}
              />
            </div>

            <div>
              <Label htmlFor="media-description">Description</Label>
              <Textarea
                id="media-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                disabled={uploading}
              />
            </div>

            {uploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {!selectedFile ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Select File
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="gradient"
                    onClick={handleSaveMedia}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Save & Upload
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelUpload}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Images: Max 5MB (JPG, PNG, WEBP) • Videos: Max 50MB (MP4)
            </p>
          </div>

          {/* Media Grid */}
          {media.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                  onClick={() => openLightbox(signedMediaUrls[item.id] || item.url, item.type)}
                >
                  {item.type === "image" ? (
                    <img
                      src={signedMediaUrls[item.id] || item.url}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <video
                        src={signedMediaUrls[item.id] || item.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {item.title}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No media uploaded yet</p>
              <p className="text-sm">Upload images or videos to showcase on your profile</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {media.find(m => signedMediaUrls[m.id] === lightboxUrl || m.url === lightboxUrl)?.title}
            </DialogTitle>
          </DialogHeader>
          {lightboxType === "image" ? (
            <img
              src={lightboxUrl || ""}
              alt="Media"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          ) : (
            <video
              src={lightboxUrl || ""}
              className="w-full h-auto max-h-[70vh]"
              controls
              autoPlay
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaManager;
