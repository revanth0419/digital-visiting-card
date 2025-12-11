import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EarnImagePickerProps = {
  label?: string;
  helperText?: string;
  storageKey?: string;
  onChange?: (dataUrl: string | null, file?: File | null) => void;
};

const EarnImagePicker = ({
  label = "Upload your own image",
  helperText = "We will use this if AI cover art is unavailable.",
  storageKey = "earn-book-cover",
  onChange,
}: EarnImagePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageKey) return;
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      setPreview(existing);
      setFileName("Saved image");
      onChange?.(existing, null);
    }
  }, [storageKey, onChange]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      setFileName(file.name);
      if (storageKey) {
        localStorage.setItem(storageKey, result);
      }
      onChange?.(result, file);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName("");
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    onChange?.(null, null);
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-100">{label}</p>
            {helperText && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="gap-2 border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900"
            >
              <Upload className="w-4 h-4" />
              Upload
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                className="text-slate-300 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {preview ? (
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <img src={preview} alt="Selected cover" className="w-full h-56 object-cover" />
            <div className="px-3 py-2 text-xs text-slate-300 bg-slate-950/60 border-t border-slate-800">
              {fileName || "Selected image"}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
            <ImageIcon className="w-5 h-5 text-slate-500" />
            <p>No image selected. We will prompt you to upload if AI cover art fails.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EarnImagePicker;

