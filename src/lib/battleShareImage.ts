// Generates a single shareable PNG that summarizes a battle outcome.
// Designed to be eye-catching and concise so people scrolling a feed
// instantly grasp the result and get curious about Spider League.

export interface BattleShareImageInput {
  winnerName: string;
  winnerImageUrl: string;
  loserName: string;
  loserImageUrl: string;
  rounds: number;
  iWon: boolean;
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSpider(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  ringColor: string,
) {
  // Ring
  ctx.save();
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 40;
  ctx.lineWidth = 8;
  ctx.strokeStyle = ringColor;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Clipped image (or placeholder)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    // cover-fit
    const ratio = Math.max(size / img.width, size / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🕷️", cx, cy);
  }
  ctx.restore();
}

export async function generateBattleShareImage(
  input: BattleShareImageInput,
): Promise<Blob | null> {
  const W = 1200;
  const H = 630; // OG-card friendly
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0712");
  bg.addColorStop(0.5, "#1a0b2e");
  bg.addColorStop(1, "#3b0a3f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle web pattern (radial glow)
  const glow = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 600);
  glow.addColorStop(0, "rgba(236, 72, 153, 0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top banner: VICTORY / DEFEAT
  const bannerText = input.iWon ? "VICTORY" : "DEFEAT";
  const bannerColor = input.iWon ? "#fbbf24" : "#f87171";
  ctx.fillStyle = bannerColor;
  ctx.font = "900 64px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = bannerColor;
  ctx.shadowBlur = 30;
  ctx.fillText(bannerText, W / 2, 50);
  ctx.shadowBlur = 0;

  // Load both spider images in parallel
  const [winnerImg, loserImg] = await Promise.all([
    loadImage(input.winnerImageUrl),
    loadImage(input.loserImageUrl),
  ]);

  // Spider portraits
  const portraitSize = 260;
  const cy = 310;
  const leftCx = 260;
  const rightCx = W - 260;
  drawSpider(ctx, winnerImg, leftCx, cy, portraitSize, "#fbbf24");
  drawSpider(ctx, loserImg, rightCx, cy, portraitSize, "#6b7280");

  // Crown / trophy badge over winner
  ctx.font = "70px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("👑", leftCx, cy - portraitSize / 2 - 30);

  // Names
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.textBaseline = "top";
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  ctx.fillText(truncate(input.winnerName, 16), leftCx, cy + portraitSize / 2 + 20);
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(truncate(input.loserName, 16), rightCx, cy + portraitSize / 2 + 20);

  // Center VS + rounds
  ctx.fillStyle = "#ec4899";
  ctx.font = "900 110px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ec4899";
  ctx.shadowBlur = 25;
  ctx.fillText("VS", W / 2, cy - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f3f4f6";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText(`${input.rounds} round${input.rounds === 1 ? "" : "s"}`, W / 2, cy + 60);

  // Footer: brand + CTA
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.fillText("🕷️ SPIDER LEAGUE", W / 2, H - 70);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText(
    input.tagline || "Upload your spider. Battle for glory. spiderleague.app",
    W / 2,
    H - 30,
  );

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
}
