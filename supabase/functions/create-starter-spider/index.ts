import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STARTER_SPECIES = [
  { species: "Garden Orb Weaver", bias: { webcraft: 15, defense: 10 } },
  { species: "Bold Jumping Spider", bias: { speed: 20, damage: 10 } },
  { species: "Common House Spider", bias: { webcraft: 10, defense: 5 } },
  { species: "Cellar Spider", bias: { speed: 10, venom: 10 } },
  { species: "Wolf Spider", bias: { speed: 15, damage: 10 } },
];

// Single starter spider image for all new users
const STARTER_IMAGE = "https://www.spiderleague.app/images/starter-spider.png";

const NICKNAME_ADJECTIVES = [
  "Shadow","Crimson","Iron","Silk","Night","Ember","Storm","Ghost","Venom","Glimmer",
  "Swift","Steel","Dark","Thunder","Frost","Cinder","Obsidian","Velvet","Rogue","Mystic",
  "Savage","Lunar","Solar","Phantom","Wicked","Onyx","Scarlet","Ivory","Jade","Cobalt",
  "Amber","Hollow","Wild","Feral","Silent","Brutal","Toxic","Arcane","Hex","Rune",
  "Vex","Grim","Bone","Ash","Blood","Twilight","Midnight","Eclipse","Nebula","Quantum",
  "Razor","Spectral","Hexed","Cursed","Sable","Crystal","Plasma","Neon","Chrome","Rust",
];
const NICKNAME_NOUNS = [
  "Weaver","Stalker","Spinner","Fang","Crawler","Prowler","Skitter","Bite","Warden","Hunter",
  "Striker","Whisper","Reaper","Shade","Specter","Wraith","Drifter","Maven","Sentinel","Marauder",
  "Talon","Claw","Sting","Veil","Knot","Thread","Loom","Snare","Tangle","Vortex",
];
const MYTHIC_NAMES = [
  "Anansi","Arachne","Atropos","Charlotte","Morrigan","Nyx","Hecate","Lilith","Medusa","Selene",
  "Shelob","Aragog","Ungoliant","Mab","Titania","Morgana","Circe","Calypso",
];
const SINGLE_WORDS = [
  "Inkwell","Pepper","Domino","Pumpkin","Biscuit","Mocha","Cricket","Pebble","Marble","Truffle",
  "Hazel","Saffron","Clover","Juniper","Sage","Cypress","Indigo","Cobweb","Bramble",
  "Twitch","Wiggle","Scuttle","Tippy","Boots","Mittens","Pickle","Noodle","Beanie","Sprout",
];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
function generateNickname(): string {
  const r = Math.random();
  if (r < 0.55) return `${pick(NICKNAME_ADJECTIVES)}${pick(NICKNAME_NOUNS)}`;
  if (r < 0.75) return pick(SINGLE_WORDS);
  if (r < 0.9) return pick(MYTHIC_NAMES);
  return `${pick(NICKNAME_ADJECTIVES)} ${pick(MYTHIC_NAMES)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.user.id;

    // Get user's display name for the starter spider nickname
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    const displayName = profileData?.display_name || claimsData.user.email?.split("@")[0] || "Player";

    // Check if user already has any spiders (prevent duplicate starters)
    const { count } = await supabase
      .from("spiders")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (count && count > 0) {
      // User already has spiders, return the first one. If it's still the
      // boring default "X's Starter Spider" nickname, upgrade it to a
      // personality nickname so new players have flair from day one.
      let { data: existing } = await supabase
        .from("spiders")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (existing && typeof existing.nickname === "string" &&
          /\sStarter Spider$/i.test(existing.nickname)) {
        const newNickname = generateNickname();
        const newSpecies = STARTER_SPECIES[Math.floor(Math.random() * STARTER_SPECIES.length)].species;
        const { data: updated } = await supabase
          .from("spiders")
          .update({ nickname: newNickname, species: newSpecies })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updated) existing = updated;
      }

      return new Response(JSON.stringify({ spider: existing, alreadyExists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pick a random starter species
    const starter = STARTER_SPECIES[Math.floor(Math.random() * STARTER_SPECIES.length)];
    const nickname = generateNickname();
    const image = STARTER_IMAGE;

    // Generate stats targeting ~250 total power score
    const TARGET = 250;
    const basePerStat = Math.floor(TARGET / 6);
    const variance = 10;

    const randStat = (base: number, bonus = 0) => {
      const val = base + Math.floor(Math.random() * variance * 2) - variance + bonus;
      return Math.max(10, Math.min(100, val));
    };

    const bias = starter.bias as Record<string, number>;
    const hit_points = randStat(basePerStat, bias.hit_points || 0);
    const damage = randStat(basePerStat, bias.damage || 0);
    const speed = randStat(basePerStat, bias.speed || 0);
    const defense = randStat(basePerStat, bias.defense || 0);
    const venom = randStat(basePerStat, bias.venom || 0);
    const webcraft = randStat(basePerStat, bias.webcraft || 0);
    const power_score = hit_points + damage + speed + defense + venom + webcraft;

    const rng_seed = Math.random().toString(36).substring(2, 10);
    const eligible_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: spider, error: insertError } = await supabase
      .from("spiders")
      .insert({
        owner_id: userId,
        nickname,
        species: starter.species,
        image_url: image,
        hit_points,
        damage,
        speed,
        defense,
        venom,
        webcraft,
        power_score,
        rarity: power_score >= 280 ? "LEGENDARY" : power_score >= 240 ? "EPIC" : power_score >= 200 ? "RARE" : "COMMON",
        rng_seed,
        is_approved: true,
        eligible_until,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ spider, alreadyExists: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Create starter spider error:", error);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
