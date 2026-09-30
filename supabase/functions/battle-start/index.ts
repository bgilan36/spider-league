import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  isAttackStance,
  isDefenseStance,
  type AttackStance,
  type DefenseStance,
} from "../_shared/battle-math.ts";
import {
  findActiveBattleForSpider, findBattleByKey, isDemoUser, loadPlayerSpider,
  pickOpponent, publicSpider, validateOpponent,
} from "../_shared/matchmaking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userSupabase.auth.getUser(token);
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.user.id;
    const now = new Date().toISOString();

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }

    const playerStance = body?.playerStance ?? {};
    const attackStance: AttackStance = isAttackStance(playerStance.attack) ? playerStance.attack : "power_strike";
    const defenseStance: DefenseStance = isDefenseStance(playerStance.defense) ? playerStance.defense : "iron_web";
    const requestedSpiderId: string | null = body?.spiderId ?? null;
    const leagueId: string | null = body?.leagueId ?? null;
    const requestedOpponentSpiderId: string | null = body?.opponentSpiderId ?? null;
    const requestedOpponentUserId: string | null = body?.opponentUserId ?? null;

    let leagueOpponentOwnerIds: string[] | null = null;
    if (leagueId) {
      const { data: membership, error: membershipError } = await supabase
        .from("private_league_members").select("user_id").eq("league_id", leagueId);
      if (membershipError) throw membershipError;
      const isMember = membership?.some((m: any) => m.user_id === userId);
      if (!isMember) {
        return new Response(JSON.stringify({ error: "You are not a member of this pod." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      leagueOpponentOwnerIds = (membership || [])
        .map((m: any) => m.user_id).filter((id: string) => id !== userId);
      if (leagueOpponentOwnerIds.length === 0) {
        return new Response(JSON.stringify({ error: "Invite at least one friend before starting a pod battle." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const action: "preview" | "start" = body?.action === "preview" ? "preview" : "start";
    const bindOpponent: boolean = body?.bindOpponent === true;
    const idempotencyKey: string | null =
      typeof body?.idempotencyKey === "string" && /^[A-Za-z0-9-]{8,80}$/.test(body.idempotencyKey)
        ? body.idempotencyKey : null;
    const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Duplicate submit of the same confirmed preview -> return the same battle.
    const existingByKey = await findBattleByKey(supabase, userId, idempotencyKey);
    if (existingByKey) return json({ success: true, battleId: existingByKey, resumed: true });

    const playerSpider = await loadPlayerSpider(supabase, userId, requestedSpiderId);
    if (!playerSpider) {
      return json({ error: "No eligible spiders available. Your spider may be on cooldown or expired.", code: "PLAYER_INELIGIBLE" });
    }

    let opponent: any = null;
    if (requestedOpponentSpiderId) {
      const v = await validateOpponent(supabase, userId, requestedOpponentSpiderId, leagueOpponentOwnerIds);
      if (v.opponent) opponent = v.opponent;
      else if (bindOpponent) {
        // Never silently substitute a confirmed opponent.
        return json({ error: v.reason, code: "MATCHUP_INVALID", reason: v.reason });
      }
    }
    if (!opponent && requestedOpponentUserId && requestedOpponentUserId !== userId &&
        (!leagueOpponentOwnerIds || leagueOpponentOwnerIds.includes(requestedOpponentUserId))) {
      const { data } = await supabase.from("spiders").select("*")
        .eq("owner_id", requestedOpponentUserId).eq("is_approved", true)
        .gt("eligible_until", now).order("power_score", { ascending: false }).limit(1);
      if (data?.[0] && !(await isDemoUser(supabase, requestedOpponentUserId))) opponent = data[0];
    }
    if (!opponent) opponent = await pickOpponent(supabase, userId, playerSpider, leagueOpponentOwnerIds);
    if (!opponent) return json({ error: "No opponent spiders available right now.", code: "NO_OPPONENT" });

    if (action === "preview") {
      return json({
        success: true, mode: "training",
        player: publicSpider(playerSpider), opponent: publicSpider(opponent),
      });
    }

    // Resume an in-progress battle for this spider instead of creating a duplicate.
    const activeId = await findActiveBattleForSpider(supabase, userId, playerSpider.id);
    if (activeId) return json({ success: true, battleId: activeId, resumed: true });

    const playerIsDemo = await isDemoUser(supabase, userId);

    // Pick faster spider to act first (minor — supports the "speed matters" feel).
    const playerActsFirst = playerSpider.speed >= opponent.speed;

    // Auto-accept training challenge.
    const { data: challengeData, error: challengeError } = await supabase
      .from("battle_challenges").insert({
        challenger_id: userId,
        challenger_spider_id: playerSpider.id,
        accepter_id: opponent.owner_id,
        accepter_spider_id: opponent.id,
        status: "ACCEPTED",
        is_all_or_nothing: false,
        challenge_message: leagueId ? "Pod Skill Battle" : "Skill Battle",
        league_id: leagueId,
      }).select("id").single();
    if (challengeError) throw challengeError;

    const stances = {
      [userId]: { attack: attackStance, defense: defenseStance },
      [opponent.owner_id]: { attack: "power_strike", defense: "iron_web" },
    };

    const seed = crypto.randomUUID();
    const firstActor = playerActsFirst ? userId : opponent.owner_id;

    const { data: battleData, error: battleError } = await supabase
      .from("battles").insert({
        challenge_id: challengeData.id,
        stakes_type: "training",
        team_a: { userId, spider: playerSpider },
        team_b: { userId: opponent.owner_id, spider: opponent },
        current_turn_user_id: firstActor,
        p1_current_hp: playerSpider.hit_points,
        p2_current_hp: opponent.hit_points,
        is_active: true,
        rng_seed: seed,
        league_id: leagueId,
        mode: "interactive",
        stances,
        awaiting_action: "attack",
        awaiting_user_id: firstActor,
        idempotency_key: idempotencyKey,
        is_demo: playerIsDemo,
      }).select("id").single();
    if (battleError) {
      // Lost a race with an identical submit: hand back the winner.
      const raced = await findBattleByKey(supabase, userId, idempotencyKey);
      if (raced) {
        await supabase.from("battle_challenges").delete().eq("id", challengeData.id);
        return json({ success: true, battleId: raced, resumed: true });
      }
      throw battleError;
    }

    await supabase.from("battle_challenges")
      .update({ battle_id: battleData.id }).eq("id", challengeData.id);

    return json({ success: true, battleId: battleData.id, leagueId, opponentSpiderId: opponent.id });
  } catch (error: any) {
    console.error("battle-start error:", error);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
