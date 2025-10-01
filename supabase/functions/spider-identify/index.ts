import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

function generateNickname(species: string) {
  const adjectives = [
    "Shadow", "Crimson", "Iron", "Silk", "Night", "Ember", "Storm", 
    "Ghost", "Venom", "Glimmer", "Swift", "Steel", "Dark", "Thunder"
  ];
  const nouns = [
    "Weaver", "Stalker", "Spinner", "Fang", "Crawler", "Prowler", 
    "Skitter", "Bite", "Warden", "Hunter", "Striker", "Whisper"
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
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
    const { image, topK = 5 } = await req.json();

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

    console.log("Starting spider identification with Lovable AI vision...");

    // Use Gemini 2.5 Flash vision model for spider identification
    const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and identify the spider species. Provide multiple possible species names in order of likelihood. Focus on US-native spiders. Include scientific names, common names, and family names. List at least 5 possible spider species even if confidence is lower for some. Format your response as a list of species, one per line, starting with the most likely.`
              },
              {
                type: "image_url",
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

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

    const visionData = await visionResponse.json();
    const aiResponse = visionData.choices?.[0]?.message?.content || "";
    
    console.log("AI Vision Response:", aiResponse);

    if (!aiResponse || aiResponse.length < 10) {
      throw new Error("AI failed to identify the image. Please ensure it shows a spider.");
    }

    // Parse AI response to extract species names
    const lines = aiResponse.split('\n').filter((line: string) => line.trim().length > 0);
    const spiderFiltered: Array<{ label: string; score: number }> = [];
    
    // Extract species names from AI response (looking for scientific names, common names)
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].toLowerCase();
      
      // Skip lines that are clearly not species names
      if (line.length < 5 || line.includes('image') || line.includes('analysis') || 
          line.includes('please') || line.includes('however') || line.includes('cannot')) {
        continue;
      }
      
      // Calculate confidence based on position (earlier = higher confidence)
      const positionScore = 1.0 - (i * 0.08); // Decreases by 8% per position
      const baseScore = Math.max(0.4, positionScore);
      
      spiderFiltered.push({
        label: line.replace(/^\d+[\.\)\-]\s*/, '').trim(), // Remove numbering
        score: baseScore
      });
    }

    console.log("Parsed species from AI:", spiderFiltered);

    if (spiderFiltered.length === 0) {
      throw new Error("No spider species detected. Please upload a clear image of a spider.");
    }

    // Map to database with US-native prioritization
    const candidatesWithDB: Array<{
      dbKey: string;
      dbData: SpiderData;
      aiLabel: string;
      aiScore: number;
      dbConfidence: number;
      combinedScore: number;
    }> = [];

    for (const result of spiderFiltered) {
      const match = getBestSpeciesMatch(result.label);
      if (match && match.data.isUSNative) { // STRICT US filter
        const combinedScore = (result.score * 0.6) + (match.confidence / 100 * 0.4);
        candidatesWithDB.push({
          dbKey: match.key,
          dbData: match.data,
          aiLabel: result.label,
          aiScore: result.score,
          dbConfidence: match.confidence,
          combinedScore
        });
      }
    }

    if (candidatesWithDB.length === 0) {
      throw new Error("Could not identify any US-native spider species. Please ensure image shows a spider found in the United States.");
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

    // Generate stats and nickname
    const statsCore = generateBiologyBasedStats(species);
    const nickname = generateNickname(species.scientificName);
    
    // Calculate power score with danger bonus
    const basePowerScore = Object.values(statsCore).reduce((sum, v) => sum + Number(v), 0);
    const dangerBonus = species.danger === 'extreme' ? 35 :
                        species.danger === 'high' ? 25 :
                        species.danger === 'moderate' ? 12 :
                        species.danger === 'low' ? 6 : 0;
    const power_score = basePowerScore + dangerBonus;
    
    // Determine rarity
    let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 310) rarity = "LEGENDARY";
    else if (power_score >= 260) rarity = "EPIC";
    else if (power_score >= 210) rarity = "RARE";
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
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
