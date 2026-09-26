import { asPng, cover, createCard, drawBrand, drawFooter, fitText, loadCardImage, muted, paper, red } from "@/lib/shareCardCanvas";

export interface SpiderShareImageInput {
  nickname: string;
  species: string;
  rarity: string;
  powerScore: number;
  imageUrl: string;
  tagline?: string;
}

const tierColors: Record<string, string> = {
  COMMON: "#a5b2bc", UNCOMMON: "#62c894", RARE: "#70b9f5", EPIC: "#cf97f4", LEGENDARY: "#ffd26c",
};

export async function generateSpiderShareImage(input: SpiderShareImageInput): Promise<Blob | null> {
  const card = createCard();
  if (!card) return null;
  const { canvas, ctx } = card;
  const image = await loadCardImage(input.imageUrl);
  const tier = (input.rarity || "COMMON").toUpperCase();
  const accent = tierColors[tier] || tierColors.COMMON;

  cover(ctx, image, 616, 6, 584, 534);
  // Keep the fighter photo legible while separating the information column.
  const shade = ctx.createLinearGradient(460, 0, 750, 0);
  shade.addColorStop(0, "#101923");
  shade.addColorStop(1, "#10192300");
  ctx.fillStyle = shade;
  ctx.fillRect(460, 6, 290, 534);
  ctx.fillStyle = accent;
  ctx.fillRect(616, 6, 7, 534);
  await drawBrand(ctx);
  ctx.fillStyle = red;
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText("MEET THE FIGHTER", 48, 148);
  ctx.fillStyle = paper;
  ctx.textAlign = "left";
  ctx.fillText(fitText(ctx, input.nickname, 525, 72), 48, 243);
  ctx.fillStyle = muted;
  ctx.font = "italic 26px system-ui, sans-serif";
  const species = input.species || "Spider";
  ctx.fillText(species, 48, 290, 525);
  ctx.fillStyle = accent;
  ctx.fillRect(48, 333, 218, 50);
  ctx.fillStyle = "#101923";
  ctx.font = "800 21px system-ui, sans-serif";
  ctx.fillText(tier, 64, 366);
  ctx.fillStyle = paper;
  ctx.fillText(fitText(ctx, String(input.powerScore), 270, 88), 48, 481);
  ctx.fillStyle = muted;
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.fillText("POWER", 235, 476);
  drawFooter(ctx);
  return asPng(canvas);
}
