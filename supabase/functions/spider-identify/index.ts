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

// Apply species-specific biases to ensure more realistic attributes (informed by ScienceFocus & SpiderSpotter)
function applySpeciesBias(species: string, stats: { hit_points: number; damage: number; speed: number; defense: number; venom: number; webcraft: number; }) {
  const s = (species || "").toLowerCase();
  let { hit_points, damage, speed, defense, venom, webcraft } = stats;

  const clamp = (n: number) => clampInt(n, 10, 100) as number;

  // Specific high-risk species first
  if (s.includes("funnel") || s.includes("funnel-web") || s.includes("atrax") || s.includes("hadronyche")) {
    // Sydney funnel-web and relatives: extremely venomous, fast, robust, web builders
    venom = 100;
    damage = Math.max(damage, 85);
    speed = Math.max(speed, 80);
    defense = Math.max(defense, 80);
    hit_points = Math.max(hit_points, 75);
    webcraft = Math.max(webcraft, 70);
  } else if ((s.includes("phoneutria") || s.includes("wandering")) || (s.includes("banana") && !s.includes("orb") && !s.includes("nephila"))) {
    // Brazilian wandering spider (Phoneutria): highly venomous, aggressive, very fast, low web use
    venom = Math.max(venom, 98);
    damage = Math.max(damage, 85);
    speed = Math.max(speed, 90);
    defense = Math.max(defense, 65);
    hit_points = Math.max(hit_points, 70);
    webcraft = Math.min(webcraft, 40);
  } else if (s.includes("sicarius") || (s.includes("six") && s.includes("eye") && s.includes("sand"))) {
    // Six-eyed sand spider (Sicarius): very potent venom, armored ambusher, low web use, slower
    venom = Math.max(venom, 97);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 55);
    defense = Math.max(defense, 80);
    hit_points = Math.max(hit_points, 65);
    webcraft = Math.min(webcraft, 30);
  } else if (s.includes("redback") || s.includes("hasselti")) {
    // Australian redback (Latrodectus hasselti): widow-type
    venom = Math.max(venom, 97);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 60);
    webcraft = Math.min(webcraft, 50);
    hit_points = Math.max(hit_points, 55);
  } else if (s.includes("missulena") || (s.includes("mouse") && s.includes("spider"))) {
    // Mouse spiders (Missulena): potent venom, sturdy build
    venom = Math.max(venom, 92);
    damage = Math.max(damage, 75);
    speed = Math.max(speed, 70);
    defense = Math.max(defense, 70);
    hit_points = Math.max(hit_points, 65);
    webcraft = Math.min(webcraft, 45);
  } else if (s.includes("widow") || s.includes("latrodectus")) {
    venom = Math.max(venom, 95);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 60);
    webcraft = Math.min(webcraft, 50);
    hit_points = Math.max(hit_points, 55);
  } else if (s.includes("recluse") || s.includes("loxosceles")) {
    venom = Math.max(venom, 90);
    damage = Math.max(damage, 70);
    webcraft = Math.min(webcraft, 50);
  } else if (s.includes("tarantula") || s.includes("theraphosa") || s.includes("aphonopelma")) {
    hit_points = Math.max(hit_points, 95);
    defense = Math.max(defense, 80);
    damage = Math.max(damage, 80);
    speed = Math.min(speed, 55);
    venom = Math.min(venom, 60);
    webcraft = Math.min(webcraft, 60);
  } else if (
    s.includes("barn") || s.includes("orb") || s.includes("weaver") || s.includes("garden") || s.includes("nephila") || s.includes("golden orb") ||
    (s.includes("banana") && (s.includes("orb") || s.includes("nephila")))
  ) {
    // Orb-weavers: excellent web builders, weak venom
    webcraft = Math.max(webcraft, 80);
    venom = Math.min(venom, 45);
    damage = Math.min(damage, 65);
    defense = Math.max(defense, 60);
    hit_points = Math.max(hit_points, 60);
  } else if (s.includes("wolf") || s.includes("lycosa")) {
    speed = Math.max(speed, 85);
    damage = Math.max(damage, 75);
    webcraft = Math.min(webcraft, 40);
    venom = Math.max(venom, 60);
    hit_points = Math.max(hit_points, 70);
  } else if (s.includes("jump") || s.includes("salticidae")) {
    speed = Math.max(speed, 80);
    damage = Math.max(damage, 65);
    webcraft = Math.min(webcraft, 35);
    hit_points = Math.max(hit_points, 55);
    defense = Math.max(defense, 55);
  } else if (s.includes("huntsman") || s.includes("heteropoda")) {
    speed = Math.max(speed, 90);
    damage = Math.max(damage, 75);
    hit_points = Math.max(hit_points, 80);
    webcraft = Math.min(webcraft, 30);
  }

  return {
    hit_points: clamp(hit_points),
    damage: clamp(damage),
    speed: clamp(speed),
    defense: clamp(defense),
    venom: clamp(venom),
    webcraft: clamp(webcraft),
  };
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

// Validate and clamp stats; fallback if needed, then apply species bias
let baseStats;
if (aiStats) {
  baseStats = {
    hit_points: clampInt(aiStats.hit_points, 10, 100),
    damage: clampInt(aiStats.damage, 10, 100),
    speed: clampInt(aiStats.speed, 10, 100),
    defense: clampInt(aiStats.defense, 10, 100),
    venom: clampInt(aiStats.venom, 10, 100),
    webcraft: clampInt(aiStats.webcraft, 10, 100),
  };
} else {
  baseStats = generateFallbackStats();
}

// Ensure realistic attributes by species
let statsCore = applySpeciesBias(species, baseStats);

// Compute power score and rarity after biasing
const power_score = Object.values(statsCore).reduce((sum, v) => sum + Number(v), 0);
let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
if (power_score >= 280) rarity = "LEGENDARY";
else if (power_score >= 240) rarity = "EPIC";
else if (power_score >= 200) rarity = "RARE";
else rarity = "COMMON";

const stats = { ...statsCore, power_score, rarity };

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
