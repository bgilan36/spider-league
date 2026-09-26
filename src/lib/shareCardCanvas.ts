// One visual system for downloadable cards and link-preview cards.
// These canvas colors are artwork colors, not interface theme colors.
import brandMark from "@/assets/share-mark.png";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const ink = "#101923";
export const paper = "#f6f5f0";
export const red = "#ed4b52";
export const muted = "#a7b4bd";

export function createCard() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, CARD_WIDTH, 6);
  return { canvas, ctx };
}

export function loadCardImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (image) {
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * scale;
    const ih = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = "#25333d";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.font = "700 26px system-ui";
    ctx.fillText("SPIDER LEAGUE", x + w / 2, y + h / 2);
  }
  ctx.restore();
}

export function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxSize: number, weight = 800) {
  const text = (value || "Unknown").trim();
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px Oswald, Impact, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return text;
    size -= 2;
  } while (size >= 28);
  ctx.font = `${weight} 28px Oswald, Impact, sans-serif`;
  let output = text;
  while (output.length > 1 && ctx.measureText(output + "…").width > maxWidth) output = output.slice(0, -1);
  return output + "…";
}

export async function drawBrand(ctx: CanvasRenderingContext2D, label = "SPIDER LEAGUE") {
  const logo = await loadCardImage(brandMark);
  if (logo) ctx.drawImage(logo, 48, 33, 54, 54);
  ctx.fillStyle = paper;
  ctx.textAlign = "left";
  ctx.font = "700 30px Oswald, Impact, sans-serif";
  ctx.fillText(label, 116, 72);
}

export function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = ink;
  ctx.fillRect(0, 540, CARD_WIDTH, 90);
  ctx.fillStyle = "#45525a";
  ctx.fillRect(48, 540, CARD_WIDTH - 96, 1);
  ctx.fillStyle = paper;
  ctx.textAlign = "left";
  ctx.font = "700 26px Oswald, Impact, sans-serif";
  ctx.fillText("SPIDERLEAGUE.APP", 48, 591);
  ctx.fillStyle = red;
  ctx.textAlign = "right";
  ctx.font = "600 19px system-ui, sans-serif";
  ctx.fillText("CATCH  /  COLLECT  /  BATTLE", CARD_WIDTH - 48, 587);
}

export function asPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}
