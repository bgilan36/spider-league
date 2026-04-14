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
const STARTER_IMAGE = "https://spider-league.lovable.app/images/starter-spider.png";

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

    // Check if user already has any spiders (prevent duplicate starters)
    const { count } = await supabase
      .from("spiders")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (count && count > 0) {
      // User already has spiders, just return the first one
      const { data: existing } = await supabase
        .from("spiders")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      return new Response(JSON.stringify({ spider: existing, alreadyExists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pick a random starter species
    const starter = STARTER_SPECIES[Math.floor(Math.random() * STARTER_SPECIES.length)];
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const nickname = `${adj}${noun}`;
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
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
