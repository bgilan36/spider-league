import { asPng, cover, createCard, drawBrand, drawFooter, fitText, ink, loadCardImage, muted, paper, red } from "@/lib/shareCardCanvas";

export interface BattleShareImageInput {
  winnerName: string;
  winnerImageUrl: string;
  loserName: string;
  loserImageUrl: string;
  rounds: number;
  iWon: boolean;
  isDraw?: boolean;
  tagline?: string;
}

export async function generateBattleShareImage(input: BattleShareImageInput): Promise<Blob | null> {
  const card = createCard();
  if (!card) return null;
  const { canvas, ctx } = card;
  const [winner, loser] = await Promise.all([loadCardImage(input.winnerImageUrl), loadCardImage(input.loserImageUrl)]);
  cover(ctx, winner, 48, 182, 506, 262);
  cover(ctx, loser, 646, 182, 506, 262);
  ctx.fillStyle = "#ffd26c";
  ctx.fillRect(48, 182, 506, 7);
  ctx.fillStyle = "#657681";
  ctx.fillRect(646, 182, 506, 7);
  ctx.fillStyle = ink;
  ctx.fillRect(527, 280, 146, 73);
  ctx.fillStyle = red;
  ctx.textAlign = "center";
  ctx.font = "800 42px Oswald, Impact, sans-serif";
  ctx.fillText("VS", 600, 332);
  await drawBrand(ctx);
  ctx.textAlign = "right";
  ctx.fillStyle = red;
  ctx.font = "700 25px Oswald, Impact, sans-serif";
  ctx.fillText(input.isDraw ? "DRAW" : input.iWon ? "VICTORY" : "BATTLE RESULT", 1152, 70);
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText(input.isDraw ? "FIGHTER 01" : "WINNER", 48, 476);
  ctx.fillText(input.isDraw ? "FIGHTER 02" : "CHALLENGER", 646, 476);
  ctx.fillStyle = paper;
  ctx.fillText(fitText(ctx, input.winnerName, 490, 43), 48, 523);
  ctx.fillText(fitText(ctx, input.loserName, 490, 43), 646, 523);
  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = "600 19px system-ui, sans-serif";
  ctx.fillText(`${input.rounds} ${input.rounds === 1 ? "ROUND" : "ROUNDS"}`, 600, 141);
  drawFooter(ctx);
  return asPng(canvas);
}
