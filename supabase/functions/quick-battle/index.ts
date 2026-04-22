import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const now = new Date().toISOString();

    // Parse request body for optional spiderId and private league scope
    let requestedSpiderId: string | null = null;
    let leagueId: string | null = null;
    try {
      const body = await req.json();
      requestedSpiderId = body?.spiderId || null;
      leagueId = body?.leagueId || null;
    } catch { /* no body */ }

    let leagueOpponentOwnerIds: string[] | null = null;
    if (leagueId) {
      const { data: membership, error: membershipError } = await supabase
        .from("private_league_members")
        .select("user_id")
        .eq("league_id", leagueId);

      if (membershipError) throw membershipError;

      const isMember = membership?.some((member: any) => member.user_id === userId);
      if (!isMember) {
        return new Response(JSON.stringify({ error: "You are not a member of this pod." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      leagueOpponentOwnerIds = (membership || [])
        .map((member: any) => member.user_id)
        .filter((memberId: string) => memberId !== userId);

      if (leagueOpponentOwnerIds.length === 0) {
        return new Response(JSON.stringify({ error: "Invite at least one friend before starting a pod battle." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Find user's spider (specific or best eligible, not on cooldown)
    const cooldownCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let playerQuery = supabase
      .from("spiders")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_approved", true)
      .gt("eligible_until", now)
      .or(`last_battled_at.is.null,last_battled_at.lt.${cooldownCutoff}`);

    if (requestedSpiderId) {
      playerQuery = playerQuery.eq("id", requestedSpiderId);
    }

    const { data: playerSpiders, error: playerError } = await playerQuery
      .order("power_score", { ascending: false })
      .limit(1);

    if (playerError) throw playerError;

    if (!playerSpiders || playerSpiders.length === 0) {
      return new Response(JSON.stringify({ error: "No eligible spiders available. Your spider may be on cooldown or expired." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const playerSpider = playerSpiders[0];

    // Find closest-matched opponent from another user
    let opponent = null;
    const bands = [0.12, 0.20, 0.35, 0.55, 1.0];
    
    for (const pct of bands) {
      const low = Math.floor(playerSpider.power_score * (1.0 - pct));
      const high = Math.ceil(playerSpider.power_score * (1.0 + pct));

      let opponentQuery = supabase
        .from("spiders")
        .select("*")
        .eq("is_approved", true)
        .neq("owner_id", userId)
        .gt("eligible_until", now)
        .or(`last_battled_at.is.null,last_battled_at.lt.${cooldownCutoff}`)
        .gte("power_score", low)
        .lte("power_score", high);

      if (leagueOpponentOwnerIds) {
        opponentQuery = opponentQuery.in("owner_id", leagueOpponentOwnerIds);
      }

      const { data: opponents } = await opponentQuery.limit(10);

      if (opponents && opponents.length > 0) {
        // Pick random from close matches
        opponent = opponents[Math.floor(Math.random() * opponents.length)];
        break;
      }
    }

    if (!opponent) {
      // Fallback: any approved spider from another user
      let fallbackQuery = supabase
        .from("spiders")
        .select("*")
        .eq("is_approved", true)
        .neq("owner_id", userId)
        .gt("eligible_until", now)
        .or(`last_battled_at.is.null,last_battled_at.lt.${cooldownCutoff}`);

      if (leagueOpponentOwnerIds) {
        fallbackQuery = fallbackQuery.in("owner_id", leagueOpponentOwnerIds);
      }

      const { data: fallback } = await fallbackQuery
        .order("power_score", { ascending: false })
        .limit(1);

      if (fallback && fallback.length > 0) {
        opponent = fallback[0];
      }
    }

    if (!opponent) {
      return new Response(JSON.stringify({ error: "No opponent spiders available right now." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create challenge (training, auto-accepted)
    const { data: challengeData, error: challengeError } = await supabase
      .from("battle_challenges")
      .insert({
        challenger_id: userId,
        challenger_spider_id: playerSpider.id,
        accepter_id: opponent.owner_id,
        accepter_spider_id: opponent.id,
        status: "ACCEPTED",
        is_all_or_nothing: false,
        challenge_message: leagueId ? "Pod Quick Battle" : "Quick Battle",
        league_id: leagueId,
      })
      .select("id")
      .single();

    if (challengeError) throw challengeError;

    // Create battle
    const { data: battleData, error: battleError } = await supabase
      .from("battles")
      .insert({
        challenge_id: challengeData.id,
        stakes_type: "training",
        team_a: { userId, spider: playerSpider },
        team_b: { userId: opponent.owner_id, spider: opponent },
        current_turn_user_id: userId,
        p1_current_hp: playerSpider.hit_points,
        p2_current_hp: opponent.hit_points,
        is_active: true,
        rng_seed: Math.random().toString(36).substring(7),
        league_id: leagueId,
      })
      .select("id")
      .single();

    if (battleError) throw battleError;

    // Update challenge with battle_id
    await supabase
      .from("battle_challenges")
      .update({ battle_id: battleData.id })
      .eq("id", challengeData.id);

    // Run the battle simulation inline (similar to auto-battle)
    const state = { p1_hp: playerSpider.hit_points, p2_hp: opponent.hit_points, turns: [] as any[] };
    let turnCount = 0;
    let currentTurnUser = userId;
    const minTurns = 4;
    const maxTurns = 12;
    const rollDice = () => Math.floor(Math.random() * 20) + 1;

    while ((state.p1_hp > 0 && state.p2_hp > 0 && turnCount < maxTurns) || turnCount < minTurns) {
      turnCount++;
      const isP1Turn = currentTurnUser === userId;
      const attacker = isP1Turn ? playerSpider : opponent;
      const defender = isP1Turn ? opponent : playerSpider;
      const defenderHp = isP1Turn ? state.p2_hp : state.p1_hp;

      const attackerDice = rollDice();
      const defenderDice = rollDice();
      const rand = Math.random();
      let actionType: string;
      let damage = 0;
      let isCritical = false;
      let dodged = false;

      if (rand < 0.75) {
        actionType = "attack";
        const turnModifier = turnCount < minTurns ? 0.5 : 1.0;
        const baseDamage = Math.floor(attacker.damage * 1.8 * turnModifier) + (attackerDice - 10);
        const defense = Math.floor(defender.defense / 18) + (defenderDice > 17 ? 2 : 0);
        if (defenderDice >= 19 && attackerDice < 20) { damage = 0; dodged = true; }
        else { damage = Math.max(5, baseDamage - defense); if (attackerDice === 20) { damage = Math.floor(damage * 2.5); isCritical = true; } }
      } else {
        actionType = "special";
        const turnModifier = turnCount < minTurns ? 0.6 : 1.0;
        const baseDamage = Math.floor(attacker.venom * 2.0 * turnModifier) + (attackerDice - 8);
        const defense = Math.floor(defender.defense / 15) + (defenderDice > 18 ? 2 : 0);
        if (defenderDice === 20 && attackerDice < 19) { damage = 0; dodged = true; }
        else { damage = Math.max(8, baseDamage - defense); if (attackerDice >= 19) { damage = Math.floor(damage * 3.0); isCritical = true; } }
      }

      const newDefenderHp = Math.max(0, defenderHp - damage);
      if (isP1Turn) state.p2_hp = newDefenderHp; else state.p1_hp = newDefenderHp;

      await supabase.from("battle_turns").insert({
        battle_id: battleData.id,
        turn_index: turnCount,
        actor_user_id: currentTurnUser,
        action_type: actionType,
        action_payload: {},
        result_payload: { action: actionType, damage, new_defender_hp: newDefenderHp, attacker_name: attacker.nickname, defender_name: defender.nickname, is_critical: isCritical, dodged },
      });

      currentTurnUser = currentTurnUser === userId ? opponent.owner_id : userId;
    }

    // Determine winner
    let winner: string;
    let winnerUser: string;
    if (state.p1_hp > state.p2_hp) { winner = "A"; winnerUser = userId; }
    else if (state.p2_hp > state.p1_hp) { winner = "B"; winnerUser = opponent.owner_id; }
    else { winner = playerSpider.power_score >= opponent.power_score ? "A" : "B"; winnerUser = winner === "A" ? userId : opponent.owner_id; }

    const loserUser = winnerUser === userId ? opponent.owner_id : userId;

    // Update battle as complete
    await supabase.from("battles").update({
      winner, is_active: false, turn_count: turnCount,
      p1_current_hp: state.p1_hp, p2_current_hp: state.p2_hp,
    }).eq("id", battleData.id);

    // Resolve challenge (uses updated RPC that handles training vs all-or-nothing)
    const { error: resolveError } = await supabase.rpc("resolve_battle_challenge", {
      challenge_id: challengeData.id,
      winner_user_id: winnerUser,
      loser_user_id: loserUser,
      battle_id_param: battleData.id,
    });

    if (resolveError) {
      console.error("Resolve error:", resolveError);
    }

    // Award badges
    await supabase.rpc("award_badges_for_user", { user_id_param: winnerUser });

    return new Response(JSON.stringify({
      success: true,
      battleId: battleData.id,
      winner: winnerUser,
      stakesType: "training",
      leagueId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Quick-battle error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
