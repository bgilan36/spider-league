import { useRef, useState } from "react";
import { Camera, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  const busy = uploading || removing;

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
      const { error: updateError } = await (supabase as any).rpc(
        "update_private_league_image",
        { p_league_id: leagueId, p_image_url: publicUrl }
      );
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
      const { error } = await (supabase as any).rpc(
        "update_private_league_image",
        { p_league_id: leagueId, p_image_url: null }
      );
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

  const thumb = (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted group">
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
      {canEdit && !busy && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5",
            "bg-background/70 opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100 group-data-[state=open]:opacity-100",
          )}
        >
          {showImage ? (
            <>
              <Pencil className="h-4 w-4 text-foreground" />
              <span className="text-[10px] font-medium leading-none text-foreground">Edit</span>
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 text-foreground" />
              <span className="text-[10px] font-medium leading-none text-foreground">Add</span>
            </>
          )}
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );

  if (!canEdit) {
    return <div className="flex items-center gap-3">{thumb}</div>;
  }

  return (
    <div className="flex items-center gap-3">
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
      {showImage ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label="Edit pod image"
            className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {thumb}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              Change image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Add pod image"
          className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {thumb}
        </button>
      )}
    </div>
  );
};

export default PodImageUploader;
