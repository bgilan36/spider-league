import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface SpiderImageCropperProps {
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export default function SpiderImageCropper({ file, onCancel, onConfirm }: SpiderImageCropperProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPixels(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyCrop = async () => {
    if (!file || !imageUrl || !cropPixels || saving) return;
    setSaving(true);
    setError(null);
    try {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      const size = Math.min(1600, Math.round(cropPixels.width));
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot crop photos.");
      context.drawImage(image, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, size, size);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not save the cropped photo.")), "image/jpeg", 0.92)
      );
      onConfirm(new File([blob], file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", { type: "image/jpeg" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not crop this photo. Try using the original.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl max-h-[95dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crop className="h-5 w-5" /> Frame your spider</DialogTitle>
          <DialogDescription>Move and zoom the photo to keep the spider clearly in frame before identification.</DialogDescription>
        </DialogHeader>
        <div className="relative h-[min(52dvh,420px)] min-h-[220px] w-full overflow-hidden rounded-md bg-muted touch-none">
          {imageUrl && <Cropper image={imageUrl} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCropPixels(pixels)} />}
        </div>
        <div className="space-y-2">
          <label htmlFor="spider-crop-zoom" className="text-sm font-medium">Zoom</label>
          <Slider id="spider-crop-zoom" min={1} max={3} step={0.01} value={[zoom]} onValueChange={([value]) => setZoom(value)} aria-label="Photo zoom" />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => { if (file) onConfirm(file); }} disabled={saving}>Use original</Button>
          <Button type="button" onClick={applyCrop} disabled={!cropPixels || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Use cropped photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}