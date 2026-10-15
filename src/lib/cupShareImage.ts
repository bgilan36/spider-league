import { asPng, cover, createCard, drawBrand, drawFooter, fitText, loadCardImage, muted, paper } from "@/lib/shareCardCanvas";
import { supabase } from "@/integrations/supabase/client";

const gold = "#ffd26c";
export const CUP_CARD_VERSION = "v1";

export async function generateCupShareImage(input: { name: string; species: string; imageUrl: string | null; weekLabel: string; owner?: string | null }) {
  const card = createCard();
  if (!card) return null;
  const { canvas, ctx } = card;
  const image = input.imageUrl ? await loadCardImage(input.imageUrl) : null;
  cover(ctx, image, 616, 6, 584, 534);
  const shade = ctx.createLinearGradient(460, 0, 750, 0);
  shade.addColorStop(0, "#101923");
  shade.addColorStop(1, "#10192300");
  ctx.fillStyle = shade;
  ctx.fillRect(460, 6, 290, 534);
  ctx.fillStyle = gold;
  ctx.fillRect(616, 6, 7, 534);
  await drawBrand(ctx);
  ctx.fillStyle = gold;
  ctx.textAlign = "left";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("🏆  GLOBAL CUP CHAMPION", 48, 150);
  ctx.fillStyle = muted;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(input.weekLabel.toUpperCase(), 48, 188, 525);
  ctx.fillStyle = paper;
  ctx.fillText(fitText(ctx, input.name, 525, 76), 48, 290);
  ctx.fillStyle = muted;
  ctx.font = "italic 26px system-ui, sans-serif";
  ctx.fillText(input.species || "Spider", 48, 338, 525);
  if (input.owner) {
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText(`Caught by ${input.owner}`, 48, 380, 525);
  }
  drawFooter(ctx);
  return asPng(canvas);
}

/** Uploads the cup card once (server stores it at a fixed public path) so link previews show it. */
export async function ensureCupCard(weekId: string, input: Parameters<typeof generateCupShareImage>[0]) {
  try {
    const blob = await generateCupShareImage(input);
    if (!blob) return;
    const b64 = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] ?? "");
      r.readAsDataURL(blob);
    });
    await supabase.functions.invoke("weekly-tournament", { body: { action: "store_cup_card", week_id: weekId, png: b64 } });
  } catch (e) {
    console.warn("cup card failed", e);
  }
}
