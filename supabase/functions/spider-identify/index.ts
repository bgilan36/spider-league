import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Enhanced US Spider Species Database
interface SpiderData {
  scientificName: string;
  family: string;
  commonNames: string[];
  danger: "extreme" | "high" | "moderate" | "low" | "minimal";
  isUSNative: boolean;
  isCommonInvasive?: boolean;
  size: { min: number; max: number }; // mm
  speedType: "slow" | "moderate" | "fast" | "very_fast";
  venomPotency: number; // 0-100
  webBuilder: boolean;
  harmfulReason?: string;
  specialAbilities: string[];
  visualKeywords: string[]; // Critical for matching
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
  // ===== DANGEROUS US SPIDERS =====
  'black_widow': {
    scientificName: 'Latrodectus mactans',
    family: 'Theridiidae',
    commonNames: ['Southern Black Widow', 'Black Widow'],
    danger: 'high',
    isUSNative: true,
    size: { min: 8, max: 13 },
    speedType: 'moderate',
    venomPotency: 95,
    webBuilder: true,
    harmfulReason: 'Neurotoxic venom - can cause severe muscle pain and cramps. Medical attention recommended.',
    specialAbilities: ['web entrapment', 'neurotoxic venom', 'hourglass marking'],
    visualKeywords: ['black', 'widow', 'red hourglass', 'shiny', 'round abdomen', 'cobweb', 'glossy'],
    baseStats: { hp: 70, damage: 85, speed: 50, defense: 60, venom: 95, webcraft: 75 }
  },
  
  'western_black_widow': {
    scientificName: 'Latrodectus hesperus',
    family: 'Theridiidae',
    commonNames: ['Western Black Widow'],
    danger: 'high',
    isUSNative: true,
    size: { min: 8, max: 13 },
    speedType: 'moderate',
    venomPotency: 95,
    webBuilder: true,
    harmfulReason: 'Neurotoxic venom - similar to Southern black widow',
    specialAbilities: ['web entrapment', 'neurotoxic venom'],
    visualKeywords: ['black', 'widow', 'red', 'hourglass', 'western', 'shiny'],
    baseStats: { hp: 70, damage: 85, speed: 50, defense: 60, venom: 95, webcraft: 75 }
  },

  'brown_recluse': {
    scientificName: 'Loxosceles reclusa',
    family: 'Sicariidae',
    commonNames: ['Brown Recluse', 'Fiddle-back Spider', 'Violin Spider'],
    danger: 'high',
    isUSNative: true,
    size: { min: 6, max: 20 },
    speedType: 'moderate',
    venomPotency: 90,
    webBuilder: false,
    harmfulReason: 'Cytotoxic venom - can cause necrotic skin lesions. Seek medical care if bitten.',
    specialAbilities: ['necrotic venom', 'stealth hunter', 'violin marking'],
    visualKeywords: ['brown', 'recluse', 'violin', 'fiddle', 'six eyes', 'tan', 'beige'],
    baseStats: { hp: 60, damage: 75, speed: 55, defense: 50, venom: 90, webcraft: 45 }
  },

  // ===== COMMON HARMLESS US SPIDERS =====
  'wolf_spider': {
    scientificName: 'Lycosidae family',
    family: 'Lycosidae',
    commonNames: ['Wolf Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 10, max: 35 },
    speedType: 'very_fast',
    venomPotency: 30,
    webBuilder: false,
    harmfulReason: 'Harmless - venom is mild, rarely worse than bee sting',
    specialAbilities: ['speed burst', 'ground hunter', 'carries young on back'],
    visualKeywords: ['wolf', 'hairy', 'brown', 'striped', 'large', 'ground', 'fast', 'robust'],
    baseStats: { hp: 80, damage: 70, speed: 90, defense: 65, venom: 30, webcraft: 20 }
  },

  'jumping_spider': {
    scientificName: 'Salticidae family',
    family: 'Salticidae',
    commonNames: ['Jumping Spider', 'Bold Jumper'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 1, max: 22 },
    speedType: 'fast',
    venomPotency: 10,
    webBuilder: false,
    harmfulReason: 'Harmless - too small to bite effectively',
    specialAbilities: ['jumping attack', 'excellent vision', 'stalking behavior'],
    visualKeywords: ['jumping', 'compact', 'large eyes', 'colorful', 'fuzzy', 'small', 'cute'],
    baseStats: { hp: 50, damage: 55, speed: 85, defense: 60, venom: 10, webcraft: 25 }
  },

  'garden_spider': {
    scientificName: 'Argiope aurantia',
    family: 'Araneidae',
    commonNames: ['Black and Yellow Garden Spider', 'Writing Spider', 'Corn Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 19, max: 28 },
    speedType: 'slow',
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: 'Harmless - beneficial for pest control, very docile',
    specialAbilities: ['orb web mastery', 'stabilimentum', 'pest control'],
    visualKeywords: ['garden', 'yellow', 'black', 'striped', 'orb', 'large abdomen', 'zig-zag web'],
    baseStats: { hp: 65, damage: 45, speed: 40, defense: 70, venom: 15, webcraft: 95 }
  },

  'orb_weaver': {
    scientificName: 'Araneidae family',
    family: 'Araneidae',
    commonNames: ['Orb Weaver Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 6, max: 20 },
    speedType: 'slow',
    venomPotency: 15,
    webBuilder: true,
    harmfulReason: 'Harmless - beneficial garden spider',
    specialAbilities: ['circular web', 'pest control'],
    visualKeywords: ['orb', 'weaver', 'circular web', 'garden', 'colorful', 'round'],
    baseStats: { hp: 60, damage: 40, speed: 35, defense: 60, venom: 20, webcraft: 90 }
  },

  'cellar_spider': {
    scientificName: 'Pholcidae family',
    family: 'Pholcidae',
    commonNames: ['Cellar Spider', 'Daddy Long-legs Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 2, max: 10 },
    speedType: 'moderate',
    venomPotency: 5,
    webBuilder: true,
    harmfulReason: 'Harmless - completely safe, beneficial indoor predator',
    specialAbilities: ['web vibration defense', 'prey wrapping'],
    visualKeywords: ['cellar', 'daddy long legs', 'thin legs', 'small body', 'tangled web'],
    baseStats: { hp: 35, damage: 30, speed: 60, defense: 40, venom: 5, webcraft: 70 }
  },

  'house_spider': {
    scientificName: 'Parasteatoda tepidariorum',
    family: 'Theridiidae',
    commonNames: ['Common House Spider', 'American House Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 4, max: 8 },
    speedType: 'moderate',
    venomPotency: 10,
    webBuilder: true,
    harmfulReason: 'Harmless - shy, beneficial for indoor pest control',
    specialAbilities: ['cobweb construction', 'indoor adaptation'],
    visualKeywords: ['house', 'brown', 'small', 'cobweb', 'indoor', 'common'],
    baseStats: { hp: 45, damage: 35, speed: 50, defense: 50, venom: 10, webcraft: 65 }
  },

  'crab_spider': {
    scientificName: 'Thomisidae family',
    family: 'Thomisidae',
    commonNames: ['Crab Spider', 'Flower Crab Spider'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 3, max: 11 },
    speedType: 'slow',
    venomPotency: 15,
    webBuilder: false,
    harmfulReason: 'Harmless - ambush predator on flowers',
    specialAbilities: ['camouflage master', 'ambush predator', 'color changing'],
    visualKeywords: ['crab', 'sideways', 'flower', 'white', 'yellow', 'flat', 'ambush'],
    baseStats: { hp: 50, damage: 60, speed: 35, defense: 75, venom: 15, webcraft: 10 }
  },

  'grass_spider': {
    scientificName: 'Agelenopsis',
    family: 'Agelenidae',
    commonNames: ['Grass Spider', 'Funnel Weaver'],
    danger: 'minimal',
    isUSNative: true,
    size: { min: 10, max: 20 },
    speedType: 'very_fast',
    venomPotency: 20,
    webBuilder: true,
    harmfulReason: 'Harmless - shy, fast runners',
    specialAbilities: ['funnel web retreat', 'sprint speed'],
    visualKeywords: ['grass', 'funnel', 'brown', 'striped', 'fast', 'sheet web', 'outdoor'],
    baseStats: { hp: 60, damage: 55, speed: 85, defense: 55, venom: 20, webcraft: 75 }
  },

  // ===== US TARANTULAS =====
  'desert_tarantula': {
    scientificName: 'Aphonopelma chalcodes',
    family: 'Theraphosidae',
    commonNames: ['Desert Blonde Tarantula', 'Arizona Blonde'],
    danger: 'low',
    isUSNative: true,
    size: { min: 50, max: 70 },
    speedType: 'slow',
    venomPotency: 25,
    webBuilder: false,
    harmfulReason: 'Mild venom - urticating hairs can irritate skin',
    specialAbilities: ['urticating hairs', 'powerful bite', 'intimidation'],
    visualKeywords: ['tarantula', 'desert', 'blonde', 'large', 'hairy', 'thick legs', 'brown'],
    baseStats: { hp: 95, damage: 80, speed: 40, defense: 85, venom: 25, webcraft: 30 }
  },

  'texas_tarantula': {
    scientificName: 'Aphonopelma hentzi',
    family: 'Theraphosidae',
    commonNames: ['Texas Brown Tarantula', 'Oklahoma Brown'],
    danger: 'low',
    isUSNative: true,
    size: { min: 50, max: 70 },
    speedType: 'slow',
    venomPotency: 25,
    webBuilder: false,
    harmfulReason: 'Mild venom - defensive but not aggressive',
    specialAbilities: ['urticating hairs', 'burrowing', 'docile'],
    visualKeywords: ['tarantula', 'brown', 'texas', 'large', 'hairy', 'burrow', 'oklahoma'],
    baseStats: { hp: 95, damage: 80, speed: 40, defense: 85, venom: 25, webcraft: 30 }
  },

  // ===== NON-US DANGEROUS (Reference only - should rank lower) =====
  'sydney_funnel_web': {
    scientificName: 'Atrax robustus',
    family: 'Atracidae',
    commonNames: ['Sydney Funnel-web Spider'],
    danger: 'extreme',
    isUSNative: false,
    isCommonInvasive: false,
    size: { min: 10, max: 50 },
    speedType: 'fast',
    venomPotency: 100,
    webBuilder: true,
    harmfulReason: 'EXTREMELY DANGEROUS - Not found in US (Australia only)',
    specialAbilities: ['deadly venom', 'aggressive behavior'],
    visualKeywords: ['funnel', 'web', 'sydney', 'australia', 'black', 'shiny'],
    baseStats: { hp: 85, damage: 95, speed: 75, defense: 80, venom: 100, webcraft: 70 }
  },

  'brazilian_wandering': {
    scientificName: 'Phoneutria',
    family: 'Ctenidae',
    commonNames: ['Brazilian Wandering Spider', 'Banana Spider'],
    danger: 'extreme',
    isUSNative: false,
    isCommonInvasive: false,
    size: { min: 15, max: 50 },
    speedType: 'very_fast',
    venomPotency: 98,
    webBuilder: false,
    harmfulReason: 'HIGHLY VENOMOUS - Not found in US (South America)',
    specialAbilities: ['potent neurotoxin', 'aggressive defense'],
    visualKeywords: ['wandering', 'banana', 'brazilian', 'aggressive', 'large'],
    baseStats: { hp: 75, damage: 90, speed: 95, defense: 70, venom: 98, webcraft: 20 }
  }
};

// Enhanced species identification with strict US filtering
function identifySpecies(label: string): Array<{ key: string; data: SpiderData; confidence: number }> {
  const normalizedLabel = label.toLowerCase();
  const matches: Array<{ key: string; data: SpiderData; confidence: number; score: number }> = [];
  
  for (const [key, data] of Object.entries(US_SPIDER_DATABASE)) {
    // STRICT: Skip non-US spiders unless explicitly common invasive
    if (!data.isUSNative && !data.isCommonInvasive) {
      continue;
    }
    
    let confidence = 0;
    
    // Check scientific name match (highest weight)
    const sciLower = data.scientificName.toLowerCase();
    if (normalizedLabel.includes(sciLower)) {
      confidence += 50;
    }
    
    // Check each word in scientific name
    const sciWords = sciLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of sciWords) {
      if (normalizedLabel.includes(word)) {
        confidence += 25;
      }
    }
    
    // Check common names (high weight)
    for (const commonName of data.commonNames) {
      const commonLower = commonName.toLowerCase();
      if (normalizedLabel.includes(commonLower)) {
        confidence += 45;
      }
      // Partial common name match
      const commonWords = commonLower.split(/\s+/);
      for (const word of commonWords) {
        if (word.length > 3 && normalizedLabel.includes(word)) {
          confidence += 20;
        }
      }
    }
    
    // Check visual keywords (critical for accuracy)
    let keywordMatches = 0;
    for (const keyword of data.visualKeywords) {
      if (normalizedLabel.includes(keyword.toLowerCase())) {
        keywordMatches++;
        confidence += 15;
      }
    }
    
    // Boost if multiple visual keywords match
    if (keywordMatches >= 3) {
      confidence += 20;
    }
    
    // Check family (medium weight)
    if (normalizedLabel.includes(data.family.toLowerCase())) {
      confidence += 12;
    }
    
    // Word overlap analysis
    const labelWords = normalizedLabel.split(/\s+/).filter(w => w.length > 3);
    const nameWords = [
      ...data.scientificName.toLowerCase().split(/\s+/),
      ...data.commonNames.flatMap(n => n.toLowerCase().split(/\s+/)),
      ...data.visualKeywords.map(k => k.toLowerCase())
    ].filter(w => w.length > 3);
    
    let wordMatches = 0;
    for (const word of labelWords) {
      if (nameWords.some(nw => nw === word || nw.includes(word) || word.includes(nw))) {
        wordMatches++;
      }
    }
    confidence += wordMatches * 8;
    
    // STRONG bonus for US native species
    if (data.isUSNative) {
      confidence *= 1.4;
    }
    
    // Only include if reasonable confidence
    if (confidence > 15) {
      matches.push({ 
        key, 
        data, 
        confidence: Math.min(100, Math.round(confidence)), 
        score: confidence 
      });
    }
  }
  
  // Sort by score and return top matches
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5);
}

// Get best match with minimum confidence threshold
function getBestSpeciesMatch(label: string): { 
  key: string; 
  data: SpiderData; 
  confidence: number;
  scientificName: string;
  commonName: string;
  family: string;
  isUSNative: boolean;
  dangerLevel: string;
  harmfulToHumans: string;
  specialAbilities: string[];
} | null {
  const matches = identifySpecies(label);
  if (matches.length === 0 || matches[0].confidence < 20) {
    return null;
  }
  
  const best = matches[0];
  return {
    key: best.key,
    data: best.data,
    confidence: best.confidence,
    scientificName: best.data.scientificName,
    commonName: best.data.commonNames[0],
    family: best.data.family,
    isUSNative: best.data.isUSNative,
    dangerLevel: best.data.danger,
    harmfulToHumans: best.data.harmfulReason || 'Unknown',
    specialAbilities: best.data.specialAbilities
  };
}

const NICKNAME_ADJECTIVES = [
  "Shadow","Crimson","Iron","Silk","Night","Ember","Storm","Ghost","Venom","Glimmer",
  "Swift","Steel","Dark","Thunder","Frost","Cinder","Obsidian","Velvet","Rogue","Mystic",
  "Savage","Lunar","Solar","Phantom","Wicked","Onyx","Scarlet","Ivory","Jade","Cobalt",
  "Amber","Hollow","Wild","Feral","Silent","Brutal","Toxic","Arcane","Hex","Rune",
  "Vex","Grim","Bone","Ash","Blood","Twilight","Midnight","Eclipse","Nebula","Quantum",
  "Razor","Spectral","Hexed","Cursed","Sable","Crystal","Plasma","Neon","Chrome","Rust",
  "Bramble","Thistle","Nettle","Moss","Fern","Bog","Dune","Tundra","Marble","Granite",
  "Whisper","Echo","Pulse","Riot","Havoc","Doom","Fury","Wrath","Mercy","Grace",
], NICKNAME_NOUNS = [
  "Weaver","Stalker","Spinner","Fang","Crawler","Prowler","Skitter","Bite","Warden","Hunter",
  "Striker","Whisper","Reaper","Shade","Specter","Wraith","Drifter","Maven","Sentinel","Marauder",
  "Talon","Claw","Sting","Veil","Knot","Thread","Loom","Snare","Tangle","Vortex",
  "Husk","Shroud","Glyph","Sigil","Oracle","Herald","Pilgrim","Nomad","Voyager","Vagabond",
  "Jester","Knight","Baron","Duchess","Empress","Witch","Sorceress","Mage","Druid","Shaman",
  "Banshee","Goblin","Imp","Gremlin","Pixie","Sprite","Faun","Wisp","Mote","Cinder",
], MYTHIC_NAMES = [
  "Anansi","Arachne","Atropos","Charlotte","Morrigan","Nyx","Hecate","Lilith","Medusa","Selene",
  "Persephone","Banshee","Mothra","Shelob","Aragog","Ungoliant","Cthulhu","Loki","Hades","Cerberus",
  "Nidhogg","Tiamat","Echidna","Scylla","Charybdis","Mab","Titania","Morgana","Circe","Calypso",
], SINGLE_WORDS = [
  "Inkwell","Pepper","Domino","Pumpkin","Biscuit","Mocha","Cricket","Pebble","Marble","Truffle",
  "Hazel","Saffron","Clover","Juniper","Sage","Cypress","Onyx","Indigo","Cobweb","Bramble",
  "Twitch","Wiggle","Scuttle","Tippy","Boots","Mittens","Pickle","Noodle","Beanie","Sprout",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateNickname(usedNames: Set<string> = new Set()): string {
  const isUsed = (n: string) => usedNames.has(n.toLowerCase());
  for (let i = 0; i < 60; i++) {
    let candidate: string;
    const r = Math.random();
    if (r < 0.55) candidate = `${pick(NICKNAME_ADJECTIVES)}${pick(NICKNAME_NOUNS)}`;
    else if (r < 0.75) candidate = pick(SINGLE_WORDS);
    else if (r < 0.9) candidate = pick(MYTHIC_NAMES);
    else candidate = `${pick(NICKNAME_ADJECTIVES)} ${pick(MYTHIC_NAMES)}`;
    if (!isUsed(candidate)) return candidate;
  }
  // Fallback: append a number until unique
  const base = `${pick(NICKNAME_ADJECTIVES)}${pick(NICKNAME_NOUNS)}`;
  for (let n = 2; n < 9999; n++) {
    const candidate = `${base}${n}`;
    if (!isUsed(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
}

// Generate biology-based attributes
function generateBiologyBasedStats(spiderData: SpiderData): {
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
} {
  const base = { ...spiderData.baseStats };
  
  // Add realistic variability (±12% for uniqueness)
  const addVariance = (value: number) => {
    const variance = (Math.random() * 24) - 12; // -12% to +12%
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
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image, topK = 5, location } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'image' (base64 string) in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("Missing LOVABLE_API_KEY secret");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting spider identification with Lovable AI vision (closed-set, structured)...");

    // Build a compact, model-friendly catalog of the candidate species we
    // actually score. The model picks from these keys — closed-set
    // classification is dramatically more reliable than open-vocabulary
    // free-text parsing.
    const catalogEntries = Object.entries(US_SPIDER_DATABASE)
      .filter(([, d]) => d.isUSNative || d.isCommonInvasive)
      .map(([key, d]) => ({
        key,
        scientific: d.scientificName,
        common: d.commonNames[0],
        family: d.family,
        size_mm: `${d.size.min}-${d.size.max}`,
        diagnostic: d.visualKeywords.slice(0, 8).join(", "),
      }));

    const locationHint = (() => {
      if (!location) return "Unknown — assume continental United States.";
      const parts: string[] = [];
      if (typeof location.latitude === "number" && typeof location.longitude === "number") {
        parts.push(`approx coords ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`);
      }
      if (location.name) parts.push(String(location.name));
      return parts.join(" — ") || "Unknown — assume continental United States.";
    })();

    const systemPrompt =
      "You are an expert arachnologist. Identify spider species from photos using diagnostic morphology: " +
      "body coloration and markings (e.g. hourglass, violin, stabilimentum), abdomen shape, leg banding/length, " +
      "eye arrangement when visible, posture, web type if visible, and approximate body size. " +
      "You MUST choose species ONLY from the provided catalog of US-relevant species. " +
      "If the image clearly does not show a spider, return isSpider=false. " +
      "Reply ONLY with a single JSON object matching the requested schema — no prose, no markdown.";

    const userInstruction =
      `Catalog of allowed species (pick the species_key from this list ONLY):\n` +
      JSON.stringify(catalogEntries) +
      `\n\nObservation location: ${locationHint}\n` +
      `Use the location to disambiguate similar species (e.g. western vs southern black widow, regional tarantulas).` +
      `\n\nReturn JSON with this exact shape:\n` +
      `{\n` +
      `  "isSpider": boolean,\n` +
      `  "observedFeatures": string,  // 1-2 sentences naming the diagnostic features you saw\n` +
      `  "candidates": [\n` +
      `    { "species_key": string, "confidence": number /* 0-100 */, "reasoning": string }\n` +
      `  ]  // up to 5 entries, sorted most likely first; species_key MUST be one of the catalog keys\n` +
      `}`;

    async function callVision(model: string, priorHint?: string) {
      const userContent: Array<Record<string, unknown>> = [
        { type: "text", text: priorHint ? `${userInstruction}\n\n${priorHint}` : userInstruction },
        { type: "image_url", image_url: { url: image } },
      ];
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
        }),
      });
    }

    // Two-tier pipeline: fast first pass with Gemini 3.6 Flash, escalate to
    // Gemini 3.1 Pro Preview only when the first pass is uncertain.
    const FAST_MODEL = "google/gemini-3.6-flash";
    const STRONG_MODEL = "google/gemini-3.1-pro-preview";
    const LITE_FALLBACK = "google/gemini-3.1-flash-lite";

    let tierUsed = "fast";
    let visionResponse = await callVision(FAST_MODEL);
    if (visionResponse.status === 429 || visionResponse.status === 503) {
      console.warn("Fast vision rate-limited; falling back to lite");
      visionResponse = await callVision(LITE_FALLBACK);
      tierUsed = "lite-fallback";
    }

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error("Lovable AI vision error:", visionResponse.status, errorText);
      if (visionResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      if (visionResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      throw new Error("AI vision analysis failed. Please try again.");
    }

    let visionData = await visionResponse.json();
    let aiResponse: string = visionData.choices?.[0]?.message?.content || "";
    console.log(`AI Vision (${tierUsed}) Response:`, aiResponse.slice(0, 800));

    // Peek at the fast-pass confidence to decide whether to escalate.
    function peekTopTwo(raw: string): { top1?: number; top2?: number; summary?: string } {
      try {
        const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
        const obj = JSON.parse(cleaned);
        const cands = Array.isArray(obj?.candidates) ? obj.candidates : [];
        const top1 = Number(cands[0]?.confidence);
        const top2 = Number(cands[1]?.confidence);
        const summary = cands
          .slice(0, 3)
          .map((c: { species_key?: string; confidence?: number }) =>
            `${c?.species_key ?? "?"} (${Math.round(Number(c?.confidence) || 0)}%)`)
          .join(", ");
        return { top1, top2, summary };
      } catch { return {}; }
    }

    if (tierUsed === "fast") {
      const { top1, top2, summary } = peekTopTwo(aiResponse);
      const uncertain =
        !Number.isFinite(top1) ||
        (top1 as number) < 70 ||
        (Number.isFinite(top2) && (top1 as number) - (top2 as number) < 10);
      if (uncertain) {
        console.log(`Escalating to ${STRONG_MODEL}; fast pass: ${summary}`);
        const priorHint = summary
          ? `A first-pass model suggested: ${summary}. Verify or correct these using the diagnostic features you actually see; prefer accuracy over agreement.`
          : undefined;
        const strong = await callVision(STRONG_MODEL, priorHint);
        if (strong.ok) {
          const strongData = await strong.json();
          const strongText: string = strongData.choices?.[0]?.message?.content || "";
          if (strongText && strongText.length > 5) {
            aiResponse = strongText;
            visionData = strongData;
            tierUsed = "strong";
            console.log("AI Vision (strong) Response:", aiResponse.slice(0, 800));
          }
        } else {
          console.warn("Escalation failed with status", strong.status, "— keeping fast result");
        }
      }
    }
    console.log(`Final tier used: ${tierUsed}`);

    if (!aiResponse || aiResponse.length < 5) {
      throw new Error("AI failed to identify the image. Please ensure it shows a spider.");
    }

    // ---- Parse structured response (with robust fallbacks) ----
    type AiCandidate = { species_key: string; confidence: number; reasoning?: string };
    let parsed: { isSpider?: boolean; observedFeatures?: string; candidates?: AiCandidate[] } = {};
    try {
      // Strip markdown fences if the model added them despite instructions.
      const cleaned = aiResponse.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Try to extract the first {...} block.
      const m = aiResponse.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (parsed.isSpider === false) {
      return new Response(
        JSON.stringify({
          error: "No spider detected in this image. Please upload a clear photo of a spider.",
          isSpider: false,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidatesWithDB: Array<{
      dbKey: string;
      dbData: SpiderData;
      aiLabel: string;
      aiScore: number;        // 0-1
      dbConfidence: number;   // 0-100
      combinedScore: number;  // 0-1
      reasoning?: string;
    }> = [];

    const aiCands = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    for (const c of aiCands) {
      if (!c || typeof c.species_key !== "string") continue;
      const key = c.species_key.trim();
      const data = US_SPIDER_DATABASE[key];
      if (!data || (!data.isUSNative && !data.isCommonInvasive)) continue;
      const aiScore = Math.max(0, Math.min(1, Number(c.confidence) / 100));
      candidatesWithDB.push({
        dbKey: key,
        dbData: data,
        aiLabel: data.commonNames[0],
        aiScore,
        dbConfidence: Math.round(aiScore * 100),
        combinedScore: aiScore,
        reasoning: typeof c.reasoning === "string" ? c.reasoning : undefined,
      });
    }

    // ---- Fallback: legacy free-text parsing if structured parse produced nothing ----
    if (candidatesWithDB.length === 0) {
      console.warn("Structured parse empty — falling back to legacy text matcher");
      const lines = aiResponse.split(/\n+/).filter((l: string) => l.trim().length > 0);
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].toLowerCase();
        if (line.length < 5) continue;
        const positionScore = Math.max(0.4, 1.0 - i * 0.08);
        const match = getBestSpeciesMatch(line.replace(/^\d+[\.\)\-]\s*/, "").trim());
        if (match && match.data.isUSNative) {
          candidatesWithDB.push({
            dbKey: match.key,
            dbData: match.data,
            aiLabel: match.commonName,
            aiScore: positionScore,
            dbConfidence: match.confidence,
            combinedScore: positionScore * 0.6 + (match.confidence / 100) * 0.4,
          });
        }
      }
    }

    if (candidatesWithDB.length === 0) {
      throw new Error("Could not identify any US-native spider species. Please ensure image shows a clear spider photo.");
    }

    // Optional: small bump for region-consistent species when a US location is provided.
    if (location && (typeof location.latitude === "number" || typeof location.name === "string")) {
      const locName = String(location.name || "").toLowerCase();
      for (const cand of candidatesWithDB) {
        const region = (US_SPIDER_DATABASE[cand.dbKey]?.commonNames.join(" ") || "").toLowerCase();
        // Lightweight regional boost based on common-name hints (e.g. "Western", "Texas", "Arizona").
        const regionalHints = ["western", "southern", "northern", "eastern", "desert", "texas", "arizona", "carolina"];
        for (const hint of regionalHints) {
          if (region.includes(hint) && locName.includes(hint)) {
            cand.combinedScore = Math.min(1, cand.combinedScore + 0.05);
          }
        }
      }
    }

    // Sort and get unique top 3
    candidatesWithDB.sort((a, b) => b.combinedScore - a.combinedScore);
    const uniqueCandidates: typeof candidatesWithDB = [];
    const seenKeys = new Set<string>();
    
    for (const candidate of candidatesWithDB) {
      if (!seenKeys.has(candidate.dbKey)) {
        uniqueCandidates.push(candidate);
        seenKeys.add(candidate.dbKey);
        if (uniqueCandidates.length >= 3) break;
      }
    }

    const topCandidate = uniqueCandidates[0];
    const species = topCandidate.dbData;
    
    console.log(`Top match: ${species.scientificName} (${species.commonNames[0]})`);
    console.log(`Confidence: ${Math.round(topCandidate.combinedScore * 100)}%`);

    // Generate stats and nickname (unique per user)
    const statsCore = generateBiologyBasedStats(species);
    const userId = claimsData.claims.sub;
    const usedNames = new Set<string>();
    try {
      const { data: existing } = await supabase
        .from('spiders')
        .select('nickname')
        .eq('owner_id', userId);
      for (const row of existing ?? []) {
        if (row?.nickname) usedNames.add(String(row.nickname).toLowerCase());
      }
    } catch (e) {
      console.warn('Could not load existing nicknames for uniqueness check', e);
    }
    const nickname = generateNickname(usedNames);
    
    // Calculate power score with danger bonus
    const basePowerScore = Object.values(statsCore).reduce((sum, v) => sum + Number(v), 0);
    const dangerBonus = species.danger === 'extreme' ? 35 :
                        species.danger === 'high' ? 25 :
                        species.danger === 'moderate' ? 12 :
                        species.danger === 'low' ? 6 : 0;
    const power_score = basePowerScore + dangerBonus;
    
    // Percentile-aligned rarity tiers (DB trigger is source of truth).
    // Common 0–50, Uncommon 50–80, Rare 80–93, Epic 93–98, Legendary 98+.
    let rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 453) rarity = "LEGENDARY";
    else if (power_score >= 368) rarity = "EPIC";
    else if (power_score >= 323) rarity = "RARE";
    else if (power_score >= 300) rarity = "UNCOMMON";
    else rarity = "COMMON";

    // Format top 3 candidates
    const topCandidates = uniqueCandidates.map((c, index) => {
      const confidence = Math.min(98, Math.max(15, Math.round(c.combinedScore * 100)));
      return {
        species: `${c.dbData.scientificName} (${c.dbData.commonNames[0]})`,
        commonName: c.dbData.commonNames[0],
        scientificName: c.dbData.scientificName,
        scientificFamily: c.dbData.family,
        commonNames: c.dbData.commonNames,
        confidence,
        isUSNative: c.dbData.isUSNative,
        isCommonInvasive: c.dbData.isCommonInvasive || false,
        harmfulToHumans: c.dbData.danger !== 'minimal',
        harmfulReason: c.dbData.harmfulReason,
        specialAbilities: c.dbData.specialAbilities,
        reasoning: c.reasoning,
        rank: index + 1
      };
    });

    // Build enhanced payload
    const payload = {
      species: topCandidates[0].species,
      scientificFamily: topCandidates[0].scientificFamily,
      commonNames: topCandidates[0].commonNames,
      nickname,
      
      confidence: topCandidates[0].confidence,
      identificationQuality: topCandidates[0].confidence >= 85 ? "very_high" : 
                            topCandidates[0].confidence >= 70 ? "high" :
                            topCandidates[0].confidence >= 50 ? "medium" : "low",
      
      topCandidates,
      
      isUSNative: species.isUSNative,
      harmfulToHumans: species.harmfulReason || 'Harmless',
      dangerLevel: species.danger,
      
      attributes: {
        hit_points: statsCore.hit_points,
        damage: statsCore.damage,
        speed: statsCore.speed,
        defense: statsCore.defense,
        venom: statsCore.venom,
        webcraft: statsCore.webcraft,
        power_score,
        rarity
      },
      
      specialAbilities: species.specialAbilities,
      
      // Legacy compatibility
      stats: { ...statsCore, power_score, rarity },
      family: species.family
    };

    console.log("✓ Spider identification complete");
    console.log(`✓ Species: ${payload.species}`);
    console.log(`✓ Confidence: ${payload.confidence}%`);
    console.log(`✓ US Native: ${payload.isUSNative}`);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in spider-identify:", error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
