// Generates a 1200x630 PNG hero card for a single spider — used for
// "just caught" reveals and spider-detail share unfurls.

export interface SpiderShareImageInput {
  nickname: string;
  species: string;
  rarity: string;
  powerScore: number;
  imageUrl: string;
  tagline?: string;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const rarityColor = (r: string): [string, string] => {
  switch ((r || "").toUpperCase()) {
    case "LEGENDARY":
      return ["#f59e0b", "#f97316"];
    case "EPIC":
      return ["#a855f7", "#d946ef"];
    case "RARE":
      return ["#3b82f6", "#06b6d4"];
    case "UNCOMMON":
      return ["#10b981", "#22c55e"];
    default:
      return ["#9ca3af", "#6b7280"];
  }
};

export async function generateSpiderShareImage(
  input: SpiderShareImageInput,
): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0712");
  bg.addColorStop(1, "#1a0b2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const [c1, c2] = rarityColor(input.rarity);
  const glow = ctx.createRadialGradient(330, H / 2, 30, 330, H / 2, 420);
  glow.addColorStop(0, `${c1}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Spider portrait
  const img = await loadImage(input.imageUrl);
  const cx = 330;
  const cy = H / 2;
  const size = 380;

  ctx.save();
  ctx.shadowColor = c1;
  ctx.shadowBlur = 50;
  ctx.lineWidth = 10;
  const ringGrad = ctx.createLinearGradient(cx - size / 2, 0, cx + size / 2, 0);
  ringGrad.addColorStop(0, c1);
  ringGrad.addColorStop(1, c2);
  ctx.strokeStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const ratio = Math.max(size / img.width, size / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🕷️", cx, cy);
  }
  ctx.restore();

  // Right column text
  const tx = 620;
  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1) + "…" : s;

  // Rarity pill
  ctx.save();
  const pillText = (input.rarity || "COMMON").toUpperCase();
  ctx.font = "800 22px system-ui, sans-serif";
  const pillW = ctx.measureText(pillText).width + 36;
  const pillH = 38;
  const pillGrad = ctx.createLinearGradient(tx, 0, tx + pillW, 0);
  pillGrad.addColorStop(0, c1);
  pillGrad.addColorStop(1, c2);
  ctx.fillStyle = pillGrad;
  ctx.beginPath();
  const px = tx;
  const py = 110;
  const pr = pillH / 2;
  ctx.moveTo(px + pr, py);
  ctx.arcTo(px + pillW, py, px + pillW, py + pillH, pr);
  ctx.arcTo(px + pillW, py + pillH, px, py + pillH, pr);
  ctx.arcTo(px, py + pillH, px, py, pr);
  ctx.arcTo(px, py, px + pillW, py, pr);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b0712";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, px + 18, py + pillH / 2 + 1);
  ctx.restore();

  // "I just caught" eyebrow
  ctx.fillStyle = "#ec4899";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("🕷️ NEW FIGHTER", tx, 70);

  // Nickname
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 68px system-ui, sans-serif";
  ctx.fillText(truncate(input.nickname, 18), tx, 170);

  // Species
  ctx.fillStyle = "#d1d5db";
  ctx.font = "italic 30px system-ui, sans-serif";
  ctx.fillText(truncate(input.species, 28), tx, 250);

  // Power
  ctx.fillStyle = "#fbbf24";
  ctx.font = "900 96px system-ui, sans-serif";
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 25;
  ctx.fillText(String(input.powerScore), tx, 320);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#9ca3af";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("POWER SCORE", tx, 430);

  // Footer
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("🕷️ SPIDER LEAGUE", W / 2, H - 50);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(input.tagline || "spiderleague.app", W / 2, H - 20);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
}