import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import type {} from "../_shared/ai-gateway.types.ts";
import { formatLocation, rankCandidates, resolveIdentification, type Candidate, type Observation } from "../_shared/species-identification.ts";
import refSpecies from "../_shared/spider-species.json" with { type: "json" };

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

// ===== Real reference library (mirrors public.spider_species) =====
type RefSpecies = {
  slug: string; common_name: string; scientific_name: string; family: string; aliases: string[];
  habitat: string; us_range: string; size_min_mm: number; size_max_mm: number;
  danger: SpiderData["danger"]; venom_potency: number; web_builder: boolean;
  speed_type: SpiderData["speedType"]; is_native: boolean; diagnostic_features: string;
  harmful_reason: string | null; special_abilities: string[];
  base_stats: SpiderData["baseStats"]; image_url: string | null; image_credit: string | null;
  wikipedia_url: string | null; summary: string | null;
};
const REF_BY_SCI = new Map<string, RefSpecies>();
for (const r of refSpecies as RefSpecies[]) {
  REF_BY_SCI.set(r.scientific_name.toLowerCase(), r);
  const legacy = Object.values(US_SPIDER_DATABASE).some(
    (d) => d.scientificName.toLowerCase() === r.scientific_name.toLowerCase(),
  );
  if (legacy || US_SPIDER_DATABASE[r.slug]) continue;
  US_SPIDER_DATABASE[r.slug] = {
    scientificName: r.scientific_name,
    family: r.family,
    commonNames: [r.common_name],
    danger: r.danger,
    isUSNative: true,
    isCommonInvasive: !r.is_native,
    size: { min: r.size_min_mm, max: r.size_max_mm },
    speedType: r.speed_type,
    venomPotency: r.venom_potency,
    webBuilder: r.web_builder,
    harmfulReason: r.harmful_reason ?? undefined,
    specialAbilities: r.special_abilities,
    visualKeywords: r.diagnostic_features.split(/,\s*/),
    baseStats: r.base_stats,
  };
}

// ---- Family-level fallbacks ----
// When a photo is clearly a spider but no specific species fits (blurry,
// juvenile, unusual species), the model picks a family group instead of
// failing. Stats are averaged from that family's catalog species.
const FAMILY_LABELS: Record<string, string> = {
  Araneidae: "Orb Weaver", Salticidae: "Jumping Spider", Lycosidae: "Wolf Spider",
  Theridiidae: "Cobweb Spider", Agelenidae: "Funnel Weaver", Thomisidae: "Crab Spider",
  Pisauridae: "Fishing / Nursery Web Spider", Pholcidae: "Cellar Spider", Sparassidae: "Huntsman Spider",
  Theraphosidae: "Tarantula", Linyphiidae: "Sheet Weaver", Tetragnathidae: "Long-jawed Orb Weaver",
  Oxyopidae: "Lynx Spider", Gnaphosidae: "Ground Spider", Clubionidae: "Sac Spider",
  Cheiracanthiidae: "Sac Spider", Eutichuridae: "Sac Spider", Dictynidae: "Mesh-web Spider",
  Uloboridae: "Hackled Orb Weaver", Anyphaenidae: "Ghost Spider", Philodromidae: "Running Crab Spider",
  Sicariidae: "Recluse Spider", Corinnidae: "Ant-mimic Sac Spider", Trachelidae: "Sac Spider",
};
const FALLBACK_KEYS = new Set<string>();
{
  const byFamily = new Map<string, SpiderData[]>();
  for (const d of Object.values(US_SPIDER_DATABASE)) {
    if (!byFamily.has(d.family)) byFamily.set(d.family, []);
    byFamily.get(d.family)?.push(d);
  }
  const avg = (list: SpiderData[]): SpiderData["baseStats"] => {
    const k = ["hp", "damage", "speed", "defense", "venom", "webcraft"] as const;
    const out = {} as SpiderData["baseStats"];
    for (const s of k) out[s] = Math.round(list.reduce((a, d) => a + d.baseStats[s], 0) / list.length);
    return out;
  };
  const mode = <T,>(arr: T[]): T => {
    const c = new Map<T, number>(); arr.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const make = (key: string, family: string, label: string, sci: string, list: SpiderData[]) => {
    US_SPIDER_DATABASE[key] = {
      scientificName: sci, family, commonNames: [label], danger: mode(list.map((d) => d.danger)),
      isUSNative: true,
      size: { min: Math.min(...list.map((d) => d.size.min)), max: Math.max(...list.map((d) => d.size.max)) },
      speedType: mode(list.map((d) => d.speedType)),
      venomPotency: Math.round(list.reduce((a, d) => a + d.venomPotency, 0) / list.length),
      webBuilder: list.filter((d) => d.webBuilder).length * 2 >= list.length,
      specialAbilities: mode(list.map((d) => d.specialAbilities)) ?? [],
      visualKeywords: [`FALLBACK group: pick only if the spider clearly belongs to ${family} but no specific species above fits`],
      baseStats: avg(list),
    };
    FALLBACK_KEYS.add(key);
  };
  const allSpecies = Object.values(US_SPIDER_DATABASE);
  for (const [family, list] of byFamily) {
    const label = FAMILY_LABELS[family];
    if (!label) continue;
    make(`group_${family.toLowerCase()}`, family, `${label} (species unconfirmed)`, `${family} sp.`, list);
  }
  make("group_unidentified_spider", "Araneae", "Unidentified Spider", "Araneae sp.", allSpecies);
  US_SPIDER_DATABASE.group_unidentified_spider.visualKeywords = ["LAST RESORT: definitely a spider, but even the family cannot be determined"];
}
function refFacts(sci: string) {
  const r = REF_BY_SCI.get(sci.toLowerCase());
  if (!r) return null;
  return {
    slug: r.slug, habitat: r.habitat, range: r.us_range,
    sizeMm: [r.size_min_mm, r.size_max_mm], diagnosticFeatures: r.diagnostic_features,
    imageUrl: r.image_url, imageCredit: r.image_credit, wikipediaUrl: r.wikipedia_url,
  };
}


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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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

    const { image, location } = await req.json();

    if (typeof image !== "string" || image.length > 12_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || (location != null && (typeof location !== "object" || (location.name != null && (typeof location.name !== "string" || location.name.length > 250)) || (location.latitude != null && (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90)) || (location.longitude != null && (!Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180))))) {
      return new Response(
        JSON.stringify({ error: "Provide a valid JPEG, PNG or WebP photo and valid optional location." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Starting spider identification with Lovable AI vision (closed-set, structured)...");

    // Short reference facts, not encyclopedic prose; no extra retrieval call.
    const clip = (s: string, n: number) => s.length > n ? s.slice(0, n) : s;
    const catalogLines = Object.entries(US_SPIDER_DATABASE)
      .filter(([, d]) => d.isUSNative || d.isCommonInvasive)
      .map(([key, d]) => {
        const ref = REF_BY_SCI.get(d.scientificName.toLowerCase());
        const diag = ref?.diagnostic_features ?? d.visualKeywords.join(", ");
        return `${key}|${d.scientificName}|${d.family}|${diag}|range:${ref?.us_range ?? "unspecified"}|habitat:${clip(ref?.habitat ?? "unspecified", 75)}`;
      }).join("\n");
    const locationHint = formatLocation(location);

    const systemPrompt =
      "You are an expert arachnologist. Identify spider species from photos using diagnostic morphology: " +
      "body coloration and markings (e.g. hourglass, violin, stabilimentum), abdomen shape, leg banding/length, " +
      "eye arrangement when visible, posture, web type if visible, and approximate body size. " +
      "Choose keys only from the reference catalog, which is North-America-focused; for out-of-catalog species return a matching family, never a forced local species. " +
      "Work step by step: first describe what you see (observedFeatures), then rank candidates. " +
      "Partial, blurry, distant, dead or juvenile views of an actual spider still count as a spider — " +
      "return isSpider=false ONLY if there is no spider at all (e.g. an insect, harvestman/daddy-longlegs opilionid, tick, or no animal). " +
      "If no specific species fits, use the matching group_* family fallback key (or group_unidentified_spider) rather than forcing a wrong species. " +
      "Return up to 3 plausible candidates; never invent alternatives to fill a quota. Confidence is an estimate, not a validated probability. Do not infer hidden eye arrangements, genitalia, body size without scale, or unseen underside markings. Brown color or a violin alone does not establish a recluse. Wolf/grass spiders, juvenile widows, and similar orb weavers often cannot be resolved to species from one view. Set speciesResolvable=false when diagnostic evidence is absent; prefer a supported family group and keep plausible species as alternatives. A web without an animal is not evidence of a spider being present. " +
      "Reply ONLY with a single JSON object matching the requested schema — no prose, no markdown.";

    const userInstruction =
      `Catalog of allowed species, one per line as key|scientific|family|diagnostic features|range|habitat (species_key = first field):\n` +
      catalogLines +
      `\n\nObservation location: ${locationHint}\n` +
      `Use range and habitat only as soft supporting evidence, never to override visible morphology or rule out introductions. If location is unknown, do not assume a region.` +
      `\n\nReturn JSON with this exact shape (be brief):\n` +
      `{\n` +
      `  "isSpider": boolean,\n` +
      `  "observedFeatures": string,  // visible evidence only, one short sentence\n` +
      `  "imageQuality": "clear" | "limited" | "poor",\n` +
      `  "speciesResolvable": boolean,\n` +
      `  "candidates": [\n` +
      `    { "species_key": string, "confidence": number /* 0-100 */, "reasoning": string /* max 15 words */, "diagnosticEvidence": boolean }\n` +
      `  ]  // 1-3 plausible entries, most likely first; species_key MUST be a catalog key\n` +
      `}`;

    const FAST_MODEL = "google/gemini-3.8-flash";
    const LITE_FALLBACK = "google/gemini-3.6-flash";
    async function callVision(model: typeof FAST_MODEL | typeof LITE_FALLBACK, priorHint?: string) {
      const result = await generateChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: priorHint ? `${userInstruction}\n\n${priorHint}` : userInstruction },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ] },
        ],
        response_format: { type: "json_object" },
        max_tokens: 700,
        reasoning_effort: "none",
      });
      const content = result.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    }

    type AiCandidate = Candidate;
    type Parsed = Observation;
    function parseAI(raw: string): Parsed {
      if (!raw) return {};
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      try { return JSON.parse(cleaned); } catch { /* try block extract */ }
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
      return {};
    }
    const validCands = (p: Parsed) => rankCandidates(p, US_SPIDER_DATABASE);
    let tierUsed = "fast";
    let fastRaw = "";
    // Speed: load admin thresholds while the first AI call runs.
    const cfgPromise = (async () => {
      try {
        const { data: cfg } = await supabase.from("species_id_config")
          .select("min_confidence, min_margin, escalation_enabled").eq("id", 1).maybeSingle();
        if (cfg) return { minConfidence: cfg.min_confidence, minMargin: cfg.min_margin, escalationEnabled: cfg.escalation_enabled };
      } catch (e) { console.warn("Config load failed, using defaults", e); }
      return { minConfidence: 70, minMargin: 10, escalationEnabled: true };
    })();
    // SDK handles safe transport retries; do not replay unknown outcomes or
    // evade rate limits by switching models.
    fastRaw = await callVision(FAST_MODEL);
    const fast = parseAI(fastRaw);
    const { minConfidence, minMargin } = await cfgPromise;
    let finalObservation = fast;
    let finalCands: AiCandidate[] = validCands(fast);
    let finalIsSpider = fast.isSpider;
    if (fast.isSpider === false || finalCands.length === 0) {
      // Only valid completed output warrants a fresh look. Do not anchor it
      // on the previous model's label or inflate confidence on agreement.
      const raw = await callVision(LITE_FALLBACK,
        "Independently inspect the actual animal. Distinguish spiders from harvestmen and insects; do not force a species without diagnostic evidence.");
      const second = parseAI(raw);
      if (second.isSpider === false && fast.isSpider === false) finalIsSpider = false;
      else if (second.isSpider === true || validCands(second).length > 0) {
        finalObservation = second;
        finalCands = validCands(second);
        finalIsSpider = true;
        tierUsed = "second-look";
      } else {
        finalIsSpider = undefined;
        finalCands = [];
      }
    }
    finalCands = resolveIdentification({ ...finalObservation, candidates: finalCands }, US_SPIDER_DATABASE, minConfidence, minMargin);
    console.log(`Final tier used: ${tierUsed}`);
    const parsed: Parsed = { isSpider: finalIsSpider, candidates: finalCands };


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

    if (candidatesWithDB.length === 0) {
      // Never dead-end: a spider photo always gets a fighter. The player can
      // pick a better match from the species list on the result screen.
      console.warn("No species matched — using Unidentified Spider fallback");
      const data = US_SPIDER_DATABASE.group_unidentified_spider;
      candidatesWithDB.push({ dbKey: "group_unidentified_spider", dbData: data, aiLabel: data.commonNames[0], aiScore: 0.3, dbConfidence: 30, combinedScore: 0.3,
        reasoning: "The photo looks like a spider, but the species couldn't be pinned down. Try a closer, sharper photo or pick the species yourself." });
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
        reference: refFacts(c.dbData.scientificName),
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
      tierUsed,
      observedFeatures: finalObservation.observedFeatures,
      imageQuality: finalObservation.imageQuality,
      identificationLevel: FALLBACK_KEYS.has(topCandidate.dbKey) ? "family" : "species",
      
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
    if (error instanceof GatewayError) {
      console.error("Spider AI failure", { code: error.code, status: error.httpStatus, outcome: error.outcome, ids: error.ids });
      const message = error.code === "payment_required" ? "AI credits exhausted. Please add credits to continue."
        : error.code === "rate_limited" ? "Rate limit exceeded. Please try again in a moment."
        : "AI vision analysis failed. Your photo is kept; please try again.";
      return new Response(JSON.stringify({ error: message }), { status: error.httpStatus === 429 ? 429 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("❌ Error in spider-identify:", error);
    const msg = error instanceof Error ? error.message : "";
    const safe = /rate limit|credits|AI vision|AI failed/i.test(msg) ? msg : "An internal error occurred. Please try again.";
    return new Response(
      JSON.stringify({ error: safe }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
