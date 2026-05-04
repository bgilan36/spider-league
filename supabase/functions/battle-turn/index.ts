import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  isBucket, pickAiBucket, resolveTurn, MAX_TURNS, MIN_TURNS,
  type ZoneBucket, type AttackStance, type DefenseStance, type SpiderLite,
} from "../_shared/battle-math.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BattleRow {
  id: string;
  team_a: any; team_b: any;
  p1_current_hp: number; p2_current_hp: number;
  turn_count: number;
  is_active: boolean;
  rng_seed: string;
  stances: Record<string, { attack: AttackStance; defense: DefenseStance }>;
  awaiting_action: "attack" | "defense" | null;
  awaiting_user_id: string | null;
  challenge_id: string | null;
  league_id: string | null;
  current_turn_user_id: string | null;
}

// One full turn = attacker's bucket + defender's bucket, then resolve damage.
// We store both buckets in pending state on `battles.battle_log` to keep things atomic.
async function maybeResolveTurn(
  supabase: any,
  battle: BattleRow,
  pending: { attackerId: string; attackerBucket: ZoneBucket; defenderBucket?: ZoneBucket; turnIndex: number; counterRiderFor?: string },
) {
  if (!pending.defenderBucket) return { battle, pending, finished: false };

  const attackerIsP1 = (battle.team_a as any).userId === pending.attackerId;
  const attacker: SpiderLite = (attackerIsP1 ? battle.team_a : battle.team_b).spider;
  const defenderTeam = attackerIsP1 ? battle.team_b : battle.team_a;
  const defender: SpiderLite = defenderTeam.spider;
  const defenderId = defenderTeam.userId;

  const stances = battle.stances || {};
  const attackerStance = stances[pending.attackerId]?.attack || "power_strike";
  const defenderStance = stances[defenderId]?.defense || "iron_web";

  const attackerHasCounterRider = pending.counterRiderFor === pending.attackerId;

  const result = resolveTurn({
    seed: battle.rng_seed,
    turnIndex: pending.turnIndex,
    attacker, defender,
    attackStance: attackerStance,
    defenseStance: defenderStance,
    attackerBucket: pending.attackerBucket,
    defenderBucket: pending.defenderBucket,
    attackerHasCounterRider,
  });

  // Apply damage.
  let p1 = battle.p1_current_hp, p2 = battle.p2_current_hp;
  if (attackerIsP1) p2 = Math.max(0, p2 - result.damage);
  else p1 = Math.max(0, p1 - result.damage);

  // Persist the turn row.
  await supabase.from("battle_turns").insert({
    battle_id: battle.id,
    turn_index: pending.turnIndex,
    actor_user_id: pending.attackerId,
    action_type: attackerStance === "venom_bite" ? "special" : "attack",
    action_payload: {
      attackerBucket: pending.attackerBucket,
      defenderBucket: pending.defenderBucket,
      attackStance: attackerStance,
      defenseStance: defenderStance,
    },
    result_payload: {
      action: attackerStance === "venom_bite" ? "special" : "attack",
      damage: result.damage,
      bonus_damage: result.bonusDamage,
      new_defender_hp: attackerIsP1 ? p2 : p1,
      attacker_name: attacker.nickname,
      defender_name: defender.nickname,
      is_critical: result.isCritical,
      dodged: result.dodged,
      attacker_dice: result.attackerDice,
      defender_dice: result.defenderDice,
      attacker_bucket: pending.attackerBucket,
      defender_bucket: pending.defenderBucket,
      attack_stance: attackerStance,
      defense_stance: defenderStance,
      breakdown: result.breakdown,
    },
  });

  // Decide next turn or finish.
  const nextTurnIndex = pending.turnIndex + 1;
  const someoneKO = (p1 <= 0 || p2 <= 0);
  const reachedMin = nextTurnIndex > MIN_TURNS;
  const reachedMax = nextTurnIndex > MAX_TURNS;
  const finished = reachedMax || (someoneKO && reachedMin);

  // Counter-Sting rider passes to whoever just took damage IF they have that defense.
  const newRider = result.defenderEarnsCounterRider ? defenderId : undefined;

  const newPending = finished ? null : {
    attackerId: defenderId, // attacker swaps each round
    attackerBucket: undefined as unknown as ZoneBucket,
    defenderBucket: undefined,
    turnIndex: nextTurnIndex,
    counterRiderFor: newRider,
  };

  const updates: any = {
    p1_current_hp: p1,
    p2_current_hp: p2,
    turn_count: pending.turnIndex,
  };
  if (finished) {
    let winner: "A" | "B";
    let winnerUser: string;
    if (p1 > p2) { winner = "A"; winnerUser = (battle.team_a as any).userId; }
    else if (p2 > p1) { winner = "B"; winnerUser = (battle.team_b as any).userId; }
    else {
      const aPower = (battle.team_a as any).spider.power_score;
      const bPower = (battle.team_b as any).spider.power_score;
      winner = aPower >= bPower ? "A" : "B";
      winnerUser = winner === "A" ? (battle.team_a as any).userId : (battle.team_b as any).userId;
    }
    const loserUser = winnerUser === (battle.team_a as any).userId
      ? (battle.team_b as any).userId : (battle.team_a as any).userId;
    updates.winner = winner;
    updates.is_active = false;
    updates.awaiting_action = null;
    updates.awaiting_user_id = null;
    updates.current_turn_user_id = null;
    updates.battle_log = { pending: null, lastRider: newRider ?? null };

    await supabase.from("battles").update(updates).eq("id", battle.id);

    if (battle.challenge_id) {
      const { error: resolveError } = await supabase.rpc("resolve_battle_challenge", {
        challenge_id: battle.challenge_id,
        winner_user_id: winnerUser,
        loser_user_id: loserUser,
        battle_id_param: battle.id,
      });
      if (resolveError) console.error("resolve error:", resolveError);
    }
    await supabase.rpc("award_badges_for_user", { user_id_param: winnerUser });
    return { battle: { ...battle, ...updates }, pending: null, finished: true };
  }

  updates.awaiting_action = "attack";
  updates.awaiting_user_id = newPending!.attackerId;
  updates.current_turn_user_id = newPending!.attackerId;
  updates.battle_log = { pending: newPending, lastRider: newRider ?? null };
  await supabase.from("battles").update(updates).eq("id", battle.id);

  return { battle: { ...battle, ...updates }, pending: newPending, finished: false };
}

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

    const body = await req.json().catch(() => ({}));
    const { battleId, bucket } = body || {};
    if (!battleId || !isBucket(bucket)) {
      return new Response(JSON.stringify({ error: "Missing battleId or bucket" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: battle, error } = await supabase
      .from("battles").select("*").eq("id", battleId).single();
    if (error || !battle) {
      return new Response(JSON.stringify({ error: "Battle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!battle.is_active) {
      return new Response(JSON.stringify({ error: "Battle is over" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (battle.awaiting_user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not your action" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log = (battle.battle_log as any) || {};
    let pending = log.pending as
      | { attackerId: string; attackerBucket: ZoneBucket; defenderBucket?: ZoneBucket; turnIndex: number; counterRiderFor?: string }
      | null;
    const lastRider: string | undefined = log.lastRider ?? undefined;

    if (!pending) {
      // First action of this round.
      pending = {
        attackerId: userId,
        attackerBucket: undefined as unknown as ZoneBucket,
        defenderBucket: undefined,
        turnIndex: (battle.turn_count || 0) + 1,
        counterRiderFor: lastRider,
      };
    }

    if (battle.awaiting_action === "attack") {
      pending.attackerId = userId;
      pending.attackerBucket = bucket as ZoneBucket;
      // Now wait on the OPPONENT to defend.
      const opponentId = userId === (battle.team_a as any).userId
        ? (battle.team_b as any).userId : (battle.team_a as any).userId;

      await supabase.from("battles").update({
        awaiting_action: "defense",
        awaiting_user_id: opponentId,
        current_turn_user_id: opponentId,
        battle_log: { pending, lastRider },
      }).eq("id", battle.id);
    } else if (battle.awaiting_action === "defense") {
      pending.defenderBucket = bucket as ZoneBucket;
      await maybeResolveTurn(supabase, battle as any as BattleRow, pending);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("battle-turn error:", error);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
