import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PodImageUploaderProps {
  leagueId: string;
  imageUrl?: string | null;
  podName: string;
  canEdit: boolean;
  onUpdated: (url: string) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

const PodImageUploader = ({ leagueId, imageUrl, podName, canEdit, onUpdated }: PodImageUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = !!imageUrl && !imgFailed;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Image too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${leagueId}/cover-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("pod-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("pod-images").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: updateError } = await (supabase as any)
        .from("private_leagues")
        .update({ image_url: publicUrl })
        .eq("id", leagueId);
      if (updateError) throw updateError;
      onUpdated(publicUrl);
      setImgFailed(false);
      toast({ title: "Pod image updated" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error } = await (supabase as any)
        .from("private_leagues")
        .update({ image_url: null })
        .eq("id", leagueId);
      if (error) throw error;
      onUpdated("");
      setImgFailed(false);
      toast({ title: "Pod image removed" });
    } catch (error: any) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {showImage ? (
          <img
            src={imageUrl!}
            alt={`${podName} pod`}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {(uploading || removing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || removing}>
              <Camera className="h-4 w-4" />
              {showImage ? "Change image" : "Add pod image"}
            </Button>
            {showImage && (
              <Button variant="ghost" size="sm" onClick={handleRemove} disabled={uploading || removing}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PodImageUploader;