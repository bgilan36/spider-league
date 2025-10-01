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

// Enhanced image preprocessing for better spider identification
function preprocessImageForSpiderID(bytes: Uint8Array, mime: string): Blob {
  // Create a proper blob for HuggingFace inference
  // This preprocessing is inspired by Picture Insect's approach
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return new Blob([buffer], { type: mime });
}

function titleCase(str: string) {
  return str
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// Comprehensive US Spider Species Database
interface SpiderData {
  family: string;
  commonNames: string[];
  danger: "extreme" | "high" | "moderate" | "low" | "minimal";
  isUSNative: boolean;
  size: "small" | "medium" | "large" | "xlarge"; // < 10mm, 10-20mm, 20-40mm, > 40mm
  speedType: "slow" | "moderate" | "fast" | "very_fast";
  venomPotency: number; // 0-100
  webBuilder: boolean;
  harmfulReason?: string;
  specialAbilities: string[];
  baseStats: {
    hp: number;
    damage: number;
    speed: number;
    defense: number;
    venom: number;
    webcraft: number;
  };
}

const US_SPIDER_DATABASE: Record<string, SpiderData> = {
  // DANGEROUS US SPIDERS
  "black widow": {
    family: "Theridiidae",
    commonNames: ["Black widow", "Southern black widow", "Western black widow"],
    danger: "high",
    isUSNative: true,
    size: "small",
    speedType: "slow",
    venomPotency: 95,
    webBuilder: true,
    harmfulReason: "Neurotoxic venom - can cause severe muscle pain, cramps, nausea. Antivenom available. Bites are rare.",
    specialAbilities: ["web entrapment", "potent neurotoxin"],
    baseStats: { hp: 50, damage: 70, speed: 40, defense: 55, venom: 95, webcraft: 75 }
  },
  "latrodectus": {
    family: "Theridiidae",
    commonNames: ["Widow spider"],
    danger: "high",
    isUSNative: true,
    size: "small",
    speedType: "slow",
    venomPotency: 95,
    webBuilder: true,
    harmfulReason: "Neurotoxic venom - medical attention recommended for bites",
    specialAbilities: ["web entrapment", "neurotoxin"],
    baseStats: { hp: 50, damage: 70, speed: 40, defense: 55, venom: 95, webcraft: 75 }
  },
  "brown recluse": {
    family: "Sicariidae",
    commonNames: ["Brown recluse", "Fiddle-back spider", "Violin spider"],
    danger: "high",
    isUSNative: true,
    size: "small",
    speedType: "moderate",
    venomPotency: 90,
    webBuilder: false,
    harmfulReason: "Cytotoxic venom - can cause necrotic lesions. Seek medical care if bitten.",
    specialAbilities: ["necrotic venom", "camouflage"],
    baseStats: { hp: 45, damage: 75, speed: 55, defense: 40, venom: 90, webcraft: 30 }
  },
  "loxosceles": {
    family: "Sicariidae",
    commonNames: ["Recluse spider"],
    danger: "high",
    isUSNative: true,
    size: "small",
    speedType: "moderate",
    venomPotency: 90,
    webBuilder: false,
    harmfulReason: "Cytotoxic venom causing tissue damage",
    specialAbilities: ["necrotic venom", "nocturnal hunter"],
    baseStats: { hp: 45, damage: 75, speed: 55, defense: 40, venom: 90, webcraft: 30 }
  },
  
  // COMMON HARMLESS US SPIDERS
  "wolf spider": {
    family: "Lycosidae",
    commonNames: ["Wolf spider"],
    danger: "minimal",
    isUSNative: true,
    size: "medium",
    speedType: "very_fast",
    venomPotency: 20,
    webBuilder: false,
    harmfulReason: "No - venom is mild, bite rarely worse than bee sting. Not aggressive.",
    specialAbilities: ["speed burst", "ambush hunter", "carries young"],
    baseStats: { hp: 70, damage: 60, speed: 90, defense: 65, venom: 25, webcraft: 20 }
  },
  "lycosa": {
    family: "Lycosidae",
    commonNames: ["Wolf spider"],
    danger: "minimal",
    isUSNative: true,
    size: "medium",
    speedType: "very_fast",
    venomPotency: 20,
    webBuilder: false,
    harmfulReason: "No - harmless to humans",
    specialAbilities: ["speed burst", "ground hunter"],
    baseStats: { hp: 70, damage: 60, speed: 90, defense: 65, venom: 25, webcraft: 20 }
  },
  "jumping spider": {
    family: "Salticidae",
    commonNames: ["Jumping spider", "Bold jumper"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "fast",
    venomPotency: 10,
    webBuilder: false,
    harmfulReason: "No - harmless, excellent vision, curious behavior. Too small to bite humans effectively.",
    specialAbilities: ["leap attack", "excellent vision", "agile"],
    baseStats: { hp: 40, damage: 45, speed: 85, defense: 50, venom: 15, webcraft: 20 }
  },
  "salticidae": {
    family: "Salticidae",
    commonNames: ["Jumping spider"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "fast",
    venomPotency: 10,
    webBuilder: false,
    harmfulReason: "No - completely harmless",
    specialAbilities: ["jumping", "vision"],
    baseStats: { hp: 40, damage: 45, speed: 85, defense: 50, venom: 15, webcraft: 20 }
  },
  "garden spider": {
    family: "Araneidae",
    commonNames: ["Garden spider", "Black and yellow garden spider", "Writing spider"],
    danger: "minimal",
    isUSNative: true,
    size: "large",
    speedType: "slow",
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: "No - beneficial for pest control, very docile. Venom not medically significant.",
    specialAbilities: ["orb web mastery", "stabilimentum", "pest control"],
    baseStats: { hp: 65, damage: 40, speed: 35, defense: 60, venom: 20, webcraft: 95 }
  },
  "orb weaver": {
    family: "Araneidae",
    commonNames: ["Orb weaver spider"],
    danger: "minimal",
    isUSNative: true,
    size: "medium",
    speedType: "slow",
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: "No - harmless, beneficial predators",
    specialAbilities: ["web building", "pest control"],
    baseStats: { hp: 60, damage: 40, speed: 35, defense: 60, venom: 20, webcraft: 90 }
  },
  "argiope": {
    family: "Araneidae",
    commonNames: ["Garden spider", "Banded garden spider"],
    danger: "minimal",
    isUSNative: true,
    size: "large",
    speedType: "slow",
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: "No - beneficial spider",
    specialAbilities: ["decorative web", "pest control"],
    baseStats: { hp: 65, damage: 40, speed: 35, defense: 60, venom: 20, webcraft: 95 }
  },
  "cellar spider": {
    family: "Pholcidae",
    commonNames: ["Cellar spider", "Daddy long-legs spider"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "slow",
    venomPotency: 5,
    webBuilder: true,
    harmfulReason: "No - myth: fangs too weak to pierce skin. Completely harmless.",
    specialAbilities: ["vibration defense", "web tangling"],
    baseStats: { hp: 30, damage: 25, speed: 40, defense: 35, venom: 10, webcraft: 70 }
  },
  "pholcus": {
    family: "Pholcidae",
    commonNames: ["Cellar spider"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "slow",
    venomPotency: 5,
    webBuilder: true,
    harmfulReason: "No - harmless",
    specialAbilities: ["vibration", "web"],
    baseStats: { hp: 30, damage: 25, speed: 40, defense: 35, venom: 10, webcraft: 70 }
  },
  "house spider": {
    family: "Theridiidae",
    commonNames: ["Common house spider", "American house spider"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "moderate",
    venomPotency: 10,
    webBuilder: true,
    harmfulReason: "No - harmless, shy, beneficial for indoor pest control.",
    specialAbilities: ["cobweb building", "pest control"],
    baseStats: { hp: 45, damage: 35, speed: 50, defense: 45, venom: 15, webcraft: 65 }
  },
  "crab spider": {
    family: "Thomisidae",
    commonNames: ["Crab spider", "Flower crab spider"],
    danger: "minimal",
    isUSNative: true,
    size: "small",
    speedType: "slow",
    venomPotency: 10,
    webBuilder: false,
    harmfulReason: "No - ambush predator, harmless to humans.",
    specialAbilities: ["camouflage", "ambush", "color changing"],
    baseStats: { hp: 40, damage: 45, speed: 30, defense: 55, venom: 15, webcraft: 10 }
  },
  "grass spider": {
    family: "Agelenidae",
    commonNames: ["Grass spider", "Funnel weaver"],
    danger: "minimal",
    isUSNative: true,
    size: "medium",
    speedType: "fast",
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: "No - shy, fast runners. Not aggressive toward humans.",
    specialAbilities: ["funnel web", "speed", "vibration sensing"],
    baseStats: { hp: 55, damage: 50, speed: 80, defense: 50, venom: 20, webcraft: 75 }
  },
  
  // US TARANTULAS
  "aphonopelma": {
    family: "Theraphosidae",
    commonNames: ["Desert tarantula", "Arizona blonde tarantula"],
    danger: "low",
    isUSNative: true,
    size: "xlarge",
    speedType: "slow",
    venomPotency: 25,
    webBuilder: false,
    harmfulReason: "No - venom mild, defensive. Urticating hairs more problematic than bite.",
    specialAbilities: ["urticating hairs", "burrow defense", "intimidation"],
    baseStats: { hp: 95, damage: 70, speed: 40, defense: 85, venom: 30, webcraft: 35 }
  },
  "tarantula": {
    family: "Theraphosidae",
    commonNames: ["Tarantula"],
    danger: "low",
    isUSNative: true,
    size: "xlarge",
    speedType: "slow",
    venomPotency: 25,
    webBuilder: false,
    harmfulReason: "No - docile, mild venom",
    specialAbilities: ["intimidation", "defense hairs"],
    baseStats: { hp: 95, damage: 70, speed: 40, defense: 85, venom: 30, webcraft: 35 }
  },
  
  // NON-US DANGEROUS (for comparison/invasive)
  "phoneutria": {
    family: "Ctenidae",
    commonNames: ["Brazilian wandering spider"],
    danger: "extreme",
    isUSNative: false,
    size: "large",
    speedType: "very_fast",
    venomPotency: 98,
    webBuilder: false,
    harmfulReason: "Yes - highly aggressive, potent neurotoxin. Medical emergency if bitten.",
    specialAbilities: ["aggression", "speed", "potent venom"],
    baseStats: { hp: 75, damage: 90, speed: 95, defense: 70, venom: 98, webcraft: 25 }
  },
  "atrax": {
    family: "Atracidae",
    commonNames: ["Sydney funnel-web spider"],
    danger: "extreme",
    isUSNative: false,
    size: "medium",
    speedType: "fast",
    venomPotency: 100,
    webBuilder: true,
    harmfulReason: "Yes - extremely dangerous venom. Native to Australia only.",
    specialAbilities: ["funnel web trap", "venom potency"],
    baseStats: { hp: 80, damage: 85, speed: 85, defense: 80, venom: 100, webcraft: 80 }
  }
};

// Enhanced species identification returning top 3 matches
function identifySpecies(label: string): Array<{
  species: string;
  data: SpiderData;
  confidence: number;
  matchKey: string;
}> {
  const s = label.toLowerCase();
  const matches: Array<{ species: string; data: SpiderData; confidence: number; matchKey: string }> = [];
  
  // Find all matching spiders in database
  for (const [key, data] of Object.entries(US_SPIDER_DATABASE)) {
    if (s.includes(key)) {
      // Calculate confidence based on keyword match quality
      const keywordMatchScore = key.length / s.length;
      const usNativeBonus = data.isUSNative ? 0.15 : 0;
      const confidence = Math.min(0.98, keywordMatchScore * 0.7 + usNativeBonus + 0.2);
      
      matches.push({
        species: titleCase(label),
        data,
        confidence,
        matchKey: key
      });
    }
  }
  
  // Sort by confidence and return top 3
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// Get single best match for backwards compatibility
function getBestSpeciesMatch(label: string): {
  species: string;
  family: string;
  commonNames: string[];
  dangerLevel: string;
  isUSNative: boolean;
  harmfulToHumans: string;
  specialAbilities: string[];
  confidence: number;
  data: SpiderData;
} {
  const matches = identifySpecies(label);
  
  if (matches.length > 0) {
    const best = matches[0];
    return {
      species: best.species,
      family: best.data.family,
      commonNames: best.data.commonNames,
      dangerLevel: best.data.danger,
      isUSNative: best.data.isUSNative,
      harmfulToHumans: best.data.harmfulReason || "Unknown",
      specialAbilities: best.data.specialAbilities,
      confidence: best.confidence,
      data: best.data
    };
  }
  
  // Fallback for unknown species
  return {
    species: titleCase(label),
    family: "Unknown",
    commonNames: [titleCase(label)],
    dangerLevel: "unknown",
    isUSNative: false,
    harmfulToHumans: "Unknown - exercise caution with unidentified spiders",
    specialAbilities: [],
    confidence: 0.25,
    data: {
      family: "Unknown",
      commonNames: [titleCase(label)],
      danger: "minimal",
      isUSNative: false,
      size: "medium",
      speedType: "moderate",
      venomPotency: 20,
      webBuilder: false,
      specialAbilities: [],
      baseStats: { hp: 50, damage: 50, speed: 50, defense: 50, venom: 50, webcraft: 50 }
    }
  };
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

// Generate biology-based attributes using database
function generateBiologyBasedStats(spiderData: SpiderData): {
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
} {
  // Start with base stats from database
  const base = { ...spiderData.baseStats };
  
  // Apply realistic variability (±15% for uniqueness)
  const addVariance = (value: number) => {
    const variance = (Math.random() * 30) - 15; // -15% to +15%
    const adjusted = Math.floor(value + (value * variance / 100));
    return Math.max(10, Math.min(100, adjusted));
  };
  
  return {
    hit_points: addVariance(base.hp),
    damage: addVariance(base.damage),
    speed: addVariance(base.speed),
    defense: addVariance(base.defense),
    venom: addVariance(base.venom),
    webcraft: addVariance(base.webcraft)
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
    
    // Multi-model ensemble approach for enhanced accuracy (inspired by Picture Insect)
    const imageBlob = preprocessImageForSpiderID(bytes, mime);
    
    // Model 1: General image classification (ResNet-50) - Good baseline
    const generalModel = "microsoft/resnet-50";
    
    // Model 2: BioCLIP - Better for biological species
    const bioModel = "imageomics/bioclip";
    
    // Model 3: Vision Transformer for better feature detection
    const vitModel = "google/vit-base-patch16-224";
    
    let allResults: any[] = [];
    let modelConfidences: number[] = [];
    
    // Try multiple models with confidence scoring (similar to Picture Insect approach)
    const models = [
      { id: generalModel, weight: 0.3, name: "General" },
      { id: bioModel, weight: 0.5, name: "Bio" }, // Higher weight for biological classifier
      { id: vitModel, weight: 0.2, name: "Vision" }
    ];
    
    for (const model of models) {
      let results: any = [];
      let attempts = 0;
      
      while (attempts < 3) {
        attempts++;
        try {
          console.log(`Attempt ${attempts}: Calling HF imageClassification with ${model.name} model ${model.id}`);
          results = await hf.imageClassification({
            model: model.id,
            data: imageBlob,
            parameters: {
              top_k: Math.max(1, Math.min(10, Number(topK) || 5))
            }
          });
          console.log(`${model.name} model success:`, results);
          
          // Weight and add results
          if (Array.isArray(results)) {
            const weightedResults = results.map((r: any) => ({
              ...r,
              score: (r.score || 0) * model.weight,
              model: model.name
            }));
            allResults.push(...weightedResults);
            modelConfidences.push(model.weight);
          }
          break;
        } catch (err: any) {
          const msg = String(err?.message || err);
          console.error(`${model.name} model attempt ${attempts} failed:`, msg);
          const shouldRetry = /503|rate|timeout|temporar|403/i.test(msg);
          if (attempts < 3 && shouldRetry) {
            const waitMs = Math.min(8000, 1000 * attempts);
            console.log(`${model.name} model retry ${attempts} in ${waitMs}ms due to:`, msg);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          // If this model fails completely, continue with others
          console.log(`${model.name} model failed completely, continuing with other models`);
          break;
        }
      }
    }
    
    // Fallback to single model if ensemble fails
    if (allResults.length === 0) {
      console.log("All models failed, falling back to single ResNet model");
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        try {
          console.log(`Fallback attempt ${attempts}: Calling HF imageClassification with model ${generalModel}`);
          allResults = await hf.imageClassification({
            model: generalModel,
            data: imageBlob,
            parameters: {
              top_k: Math.max(1, Math.min(10, Number(topK) || 5))
            }
          });
          console.log(`Fallback HF imageClassification success:`, allResults);
          break;
        } catch (err: any) {
          const msg = String(err?.message || err);
          console.error(`Fallback HF imageClassification attempt ${attempts} failed:`, msg);
          const shouldRetry = /503|rate|timeout|temporar|403/i.test(msg);
          if (attempts < 3 && shouldRetry) {
            const waitMs = Math.min(8000, 1000 * attempts);
            console.log(`Fallback HF imageClassification retry ${attempts} in ${waitMs}ms due to:`, msg);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          throw err;
        }
      }
    }

    // Aggregate and rank results by combining scores from all models
    const aggregatedResults = new Map<string, { label: string; totalScore: number; modelCount: number; models: string[] }>();
    
    for (const result of allResults) {
      const key = result.label.toLowerCase();
      if (aggregatedResults.has(key)) {
        const existing = aggregatedResults.get(key)!;
        existing.totalScore += result.score || 0;
        existing.modelCount += 1;
        existing.models.push(result.model || 'unknown');
      } else {
        aggregatedResults.set(key, {
          label: result.label,
          totalScore: result.score || 0,
          modelCount: 1,
          models: [result.model || 'unknown']
        });
      }
    }
    
    // Calculate final scores with confidence boost for multi-model agreement
    const finalResults = Array.from(aggregatedResults.values()).map(result => ({
      label: result.label,
      score: (result.totalScore / result.modelCount) * (1 + (result.modelCount - 1) * 0.1), // Boost for model agreement
      modelCount: result.modelCount,
      models: result.models
    }));

    const flat = Array.isArray(finalResults) ? finalResults : [];
    
    // Filter results to only include spider-related classifications
    const spiderKeywords = [
      'spider', 'arachnid', 'tarantula', 'widow', 'recluse', 'funnel', 'wolf', 
      'jumping', 'orb', 'huntsman', 'crab', 'lynx', 'nursery', 'cobweb',
      'phoneutria', 'latrodectus', 'loxosceles', 'atrax', 'sicarius',
      'nephila', 'lycosa', 'salticidae', 'theraphosidae', 'araneae'
    ];

    const excludeKeywords = [
      'guitar', 'instrument', 'music', 'bird', 'mammal', 'reptile', 'fish', 'insect',
      'plant', 'flower', 'tree', 'furniture', 'tool', 'vehicle', 'food', 'building',
      'person', 'human', 'face', 'hand', 'dog', 'cat', 'car', 'house', 'acoustic',
      'harvestman', 'opiliones', 'daddy long legs', 'harvester'
    ];

    const spiderFiltered = flat.filter((result: any) => {
      const label = (result.label || '').toLowerCase();
      const hasSpiderKeyword = spiderKeywords.some(keyword => label.includes(keyword));
      const hasExcludedTerm = excludeKeywords.some(keyword => label.includes(keyword));
      const meetsScore = (result.score ?? 0) >= 0.4;
      return hasSpiderKeyword && !hasExcludedTerm && meetsScore;
    });

    // If no spider results found, we only want spider classifications
    if (spiderFiltered.length === 0) {
      throw new Error("No spider species detected in this image. Please upload an image containing a spider.");
    }
    
    const finalSorted = spiderFiltered;
    
    const sorted = finalSorted
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, Math.max(1, Math.min(10, Number(topK) || 5)));

    // Get best species match from database
    const primaryMatch = getBestSpeciesMatch(sorted[0]?.label || "Unknown");
    const species = primaryMatch.species;
    const nickname = generateNickname(species);
    
    // Get top 3 species candidates
    const top3Candidates = sorted.slice(0, 3).map((candidate: any, index: number) => {
      const match = getBestSpeciesMatch(candidate.label);
      const modelScore = candidate.score || 0;
      const databaseConfidence = match.confidence;
      
      // Combined confidence: weight model score more heavily, boost for US natives
      const combinedConfidence = Math.min(98, 
        (modelScore * 0.65) + 
        (databaseConfidence * 0.30) + 
        (match.isUSNative ? 0.05 : 0)
      );
      
      return {
        species: match.species,
        scientificFamily: match.family,
        commonNames: match.commonNames,
        confidence: Math.round(combinedConfidence * 100),
        isUSNative: match.isUSNative,
        harmfulToHumans: match.harmfulToHumans,
        specialAbilities: match.specialAbilities,
        modelScore: Math.round(modelScore * 100),
        rank: index + 1
      };
    });
    
    console.log("Top 3 species candidates:", top3Candidates);

    // Generate biology-based stats using database
    const statsCore = generateBiologyBasedStats(primaryMatch.data);
    
    // Calculate power score
    const basePowerScore = Object.values(statsCore).reduce((sum, v) => sum + Number(v), 0);
    
    // Add danger-based bonus
    const dangerBonus = primaryMatch.dangerLevel === 'extreme' ? 30 :
                        primaryMatch.dangerLevel === 'high' ? 20 :
                        primaryMatch.dangerLevel === 'moderate' ? 10 :
                        primaryMatch.dangerLevel === 'low' ? 5 : 0;
    
    const power_score = basePowerScore + dangerBonus;
    
    // Determine rarity based on power score
    let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 300) rarity = "LEGENDARY";
    else if (power_score >= 250) rarity = "EPIC";
    else if (power_score >= 200) rarity = "RARE";
    else rarity = "COMMON";

    const stats = { ...statsCore, power_score, rarity };

    // Enhanced output payload
    const payload = {
      // Primary identification
      species: top3Candidates[0].species,
      scientificFamily: top3Candidates[0].scientificFamily,
      commonNames: top3Candidates[0].commonNames,
      nickname,
      
      // Confidence scoring
      confidence: top3Candidates[0].confidence,
      identificationQuality: top3Candidates[0].confidence >= 85 ? "very_high" : 
                            top3Candidates[0].confidence >= 70 ? "high" :
                            top3Candidates[0].confidence >= 50 ? "medium" : "low",
      
      // Top 3 candidates
      topCandidates: top3Candidates,
      
      // Safety information
      isUSNative: primaryMatch.isUSNative,
      harmfulToHumans: primaryMatch.harmfulToHumans,
      dangerLevel: primaryMatch.dangerLevel,
      
      // Game attributes
      attributes: {
        hit_points: stats.hit_points,
        damage: stats.damage,
        speed: stats.speed,
        defense: stats.defense,
        venom: stats.venom,
        webcraft: stats.webcraft,
        power_score: stats.power_score,
        rarity: stats.rarity
      },
      
      // Special abilities
      specialAbilities: primaryMatch.specialAbilities,
      
      // Debug info
      debug: {
        modelResults: sorted.slice(0, 3).map((r: any) => ({
          label: r.label,
          score: Math.round((r.score || 0) * 100),
          modelCount: r.modelCount || 1
        })),
        multiModelAgreement: modelConfidences.length > 1
      },
      
      // Legacy fields for compatibility
      stats,
      family: primaryMatch.family
    };

    console.log("Enhanced spider-identify result:", payload);

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
