import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface SpiderImageCropperProps {
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export default function SpiderImageCropper({ file, onCancel, onConfirm }: SpiderImageCropperProps) {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
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
    setZoom(MIN_ZOOM);
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
      const size = Math.max(1, Math.min(1600, Math.round(cropPixels.width)));
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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto_auto] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crop className="h-5 w-5" /> Crop your spider photo</DialogTitle>
          <DialogDescription>Drag the photo to frame your spider. Pinch or use the controls below to zoom.</DialogDescription>
        </DialogHeader>
        <div aria-label="Drag to frame your spider photo" className="relative h-[clamp(160px,40dvh,420px)] min-h-0 w-full overflow-hidden rounded-md bg-muted touch-none">
          {imageUrl && <Cropper image={imageUrl} crop={crop} zoom={zoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCropPixels(pixels)} />}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><label htmlFor="spider-crop-zoom" className="text-sm font-medium">Zoom</label><span className="text-sm tabular-nums text-muted-foreground">{zoom.toFixed(1)}×</span></div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Zoom out" onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 0.25))} disabled={zoom <= MIN_ZOOM}><Minus className="h-4 w-4" /></Button>
            <Slider id="spider-crop-zoom" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={[zoom]} onValueChange={([value]) => setZoom(value)} aria-label="Photo zoom" />
            <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Zoom in" onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 0.25))} disabled={zoom >= MAX_ZOOM}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="ghost" className="shrink-0" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="button" className="min-w-0 flex-1 sm:flex-none" onClick={applyCrop} disabled={!cropPixels || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Use this crop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}