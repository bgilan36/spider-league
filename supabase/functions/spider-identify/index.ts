import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseBase64Image(base64: string): { mime: string; bytes: Uint8Array } {
  const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
  const header = base64.includes(",") ? base64.split(",")[0] : "";
  let mime = "image/jpeg";
  const m = header.match(/data:(.*?);base64/);
  if (m && m[1]) mime = m[1];
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}

function titleCase(str: string) {
  return str
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function generateNickname(species: string) {
  const adjectives = [
    "Shadow",
    "Crimson",
    "Iron",
    "Silk",
    "Night",
    "Ember",
    "Storm",
    "Ghost",
    "Venom",
    "Glimmer",
  ];
  const nouns = [
    "Weaver",
    "Stalker",
    "Spinner",
    "Fang",
    "Crawler",
    "Prowler",
    "Skitter",
    "Bite",
    "Warden",
    "Hunter",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const base = `${adj}${noun}`;
  // Include hint of species for flavor
  const hint = species.split(" ")[0];
  return `${base} ${hint}`.trim();
}

// Fallback stat generator (used if LLM fails)
function generateFallbackStats() {
  const baseStats = {
    hit_points: Math.floor(Math.random() * 50) + 50,
    damage: Math.floor(Math.random() * 30) + 20,
    speed: Math.floor(Math.random() * 40) + 30,
    defense: Math.floor(Math.random() * 35) + 25,
    venom: Math.floor(Math.random() * 45) + 15,
    webcraft: Math.floor(Math.random() * 40) + 20,
  };
  const power_score = Object.values(baseStats).reduce((sum, stat) => sum + (stat as number), 0);
  let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  if (power_score >= 280) rarity = "LEGENDARY";
  else if (power_score >= 240) rarity = "EPIC";
  else if (power_score >= 200) rarity = "RARE";
  else rarity = "COMMON";
  return { ...baseStats, power_score, rarity };
}

function clampInt(n: unknown, min: number, max: number) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, topK = 5 } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'image' (base64 string) in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!token) {
      console.error("Missing HUGGING_FACE_ACCESS_TOKEN secret");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hf = new HfInference(token);

    const { mime, bytes } = parseBase64Image(image);
    const blob = new Blob([bytes], { type: mime });

    // Use Hugging Face SDK image classification with retries
    const modelId = "microsoft/resnet-50";
    let results: any = [];
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        console.log(`Attempt ${attempts}: Calling HF imageClassification with model ${modelId}`);
        results = await hf.imageClassification({
          model: modelId,
          data: blob,
          parameters: {
            top_k: Math.max(1, Math.min(10, Number(topK) || 5))
          }
        });
        console.log(`HF imageClassification success:`, results);
        break;
      } catch (err: any) {
        const msg = String(err?.message || err);
        console.error(`HF imageClassification attempt ${attempts} failed:`, msg);
        const shouldRetry = /503|rate|timeout|temporar|403/i.test(msg);
        if (attempts < 3 && shouldRetry) {
          const waitMs = Math.min(8000, 1000 * attempts);
          console.log(`HF imageClassification retry ${attempts} in ${waitMs}ms due to:`, msg);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }

    const flat = Array.isArray(results) ? results : [];
    const sorted = (flat as any[])
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, Math.max(1, Math.min(10, Number(topK) || 5)));

    const speciesRaw = sorted[0]?.label || "Unknown";
    const species = titleCase(speciesRaw);
    const nickname = generateNickname(species);

    // Ask an LLM to propose attribute stats based on species
    let aiStats: any = null;
    try {
      const prompt = `You are assigning battle attributes for a spider species. Return ONLY valid JSON with integer fields between 10 and 100 inclusive: 
{"hit_points":<int>,"damage":<int>,"speed":<int>,"defense":<int>,"venom":<int>,"webcraft":<int>} 
Base scores should reflect the real-world traits implied by the species name: "${species}" (e.g., venom for widows, speed for hunters). No commentary.`;

      const gen = await hf.textGeneration({
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
        inputs: prompt,
        parameters: { max_new_tokens: 150, temperature: 0.7, return_full_text: false },
      } as any);

      const generated = Array.isArray(gen)
        ? (gen[0] as any)?.generated_text || ""
        : (gen as any)?.generated_text || "";
      const match = generated.match(/\{[\s\S]*\}/);
      if (match) aiStats = JSON.parse(match[0]);
    } catch (e) {
      console.error("LLM stats generation failed:", e);
    }

    // Validate and clamp stats; fallback if needed
    let stats;
    if (aiStats) {
      stats = {
        hit_points: clampInt(aiStats.hit_points, 10, 100),
        damage: clampInt(aiStats.damage, 10, 100),
        speed: clampInt(aiStats.speed, 10, 100),
        defense: clampInt(aiStats.defense, 10, 100),
        venom: clampInt(aiStats.venom, 10, 100),
        webcraft: clampInt(aiStats.webcraft, 10, 100),
      };
      const power_score = Object.values(stats).reduce((sum, v) => sum + Number(v), 0);
      let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
      if (power_score >= 280) rarity = "LEGENDARY";
      else if (power_score >= 240) rarity = "EPIC";
      else if (power_score >= 200) rarity = "RARE";
      else rarity = "COMMON";
      stats = { ...stats, power_score, rarity };
    } else {
      stats = generateFallbackStats();
    }

    const payload = {
      species,
      nickname,
      candidates: sorted.map((r: any) => ({ label: titleCase(r.label), score: r.score })),
      stats,
    };

    console.log("spider-identify result:", payload);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in spider-identify:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
