import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  pickAiBucket, resolveTurn, MAX_TURNS, MIN_TURNS,
  type ZoneBucket, type AttackStance, type DefenseStance, type SpiderLite,
} from "../_shared/battle-math.ts";

function capDamageForTurn(damage: number, defenderHp: number, turnIndex: number, isFinalTurn: boolean): number {
  if (defenderHp <= 0 || damage <= 0) return 0;
  if (isFinalTurn) return Math.min(damage, defenderHp);
  const maxChunk = Math.max(1, Math.floor(defenderHp * (turnIndex <= MIN_TURNS ? 0.35 : 0.55)));
  return Math.min(damage, maxChunk, Math.max(1, defenderHp - 1));
}

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
    const { data: claims } = await userSupabase.auth.getUser(token);
    if (!claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.user.id;

    const body = await req.json().catch(() => ({}));
    const { battleId } = body || {};
    if (!battleId) {
      return new Response(JSON.stringify({ error: "Missing battleId" }), {
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
      return new Response(JSON.stringify({ success: true, finished: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Caller must be a participant.
    const teamAUser = (battle.team_a as any).userId;
    const teamBUser = (battle.team_b as any).userId;
    if (userId !== teamAUser && userId !== teamBUser) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The AI is whichever participant is NOT the caller. If awaiting user is the
    // caller, nothing for us to do.
    const opponentId = userId === teamAUser ? teamBUser : teamAUser;
    if (battle.awaiting_user_id !== opponentId) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const opponentSpider: SpiderLite = (opponentId === teamAUser ? battle.team_a : battle.team_b).spider;
    const playerSpider: SpiderLite = (userId === teamAUser ? battle.team_a : battle.team_b).spider;

    const log = (battle.battle_log as any) || {};
    let pending = log.pending as any;
    const lastRider: string | undefined = log.lastRider ?? undefined;
    const stances = (battle.stances as any) || {};

    if (battle.awaiting_action === "attack") {
      const turnIndex = (battle.turn_count || 0) + 1;
      const bucket: ZoneBucket = pickAiBucket(opponentSpider, playerSpider, battle.rng_seed, turnIndex, "atk");
      pending = {
        attackerId: opponentId,
        attackerBucket: bucket,
        defenderBucket: undefined,
        turnIndex,
        counterRiderFor: lastRider,
      };
      await supabase.from("battles").update({
        awaiting_action: "defense",
        awaiting_user_id: userId,
        current_turn_user_id: userId,
        battle_log: { pending, lastRider },
      }).eq("id", battle.id);
      return new Response(JSON.stringify({ success: true, opponentBucket: bucket }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (battle.awaiting_action === "defense") {
      // AI defends, then resolve.
      const turnIndex = pending?.turnIndex ?? (battle.turn_count || 0) + 1;
      const defenderBucket: ZoneBucket = pickAiBucket(opponentSpider, playerSpider, battle.rng_seed, turnIndex, "def");
      pending = { ...(pending || {}), defenderBucket };

      const attackerId = pending.attackerId;
      const attackerIsP1 = teamAUser === attackerId;
      const attacker: SpiderLite = (attackerIsP1 ? battle.team_a : battle.team_b).spider;
      const defenderTeam = attackerIsP1 ? battle.team_b : battle.team_a;
      const defender: SpiderLite = defenderTeam.spider;
      const defenderId = defenderTeam.userId;

      const attackerStance: AttackStance = stances[attackerId]?.attack || "power_strike";
      const defenderStance: DefenseStance = stances[defenderId]?.defense || "iron_web";
      const attackerHasCounterRider = lastRider === attackerId;

      const result = resolveTurn({
        seed: battle.rng_seed,
        turnIndex,
        attacker, defender,
        attackStance: attackerStance,
        defenseStance: defenderStance,
        attackerBucket: pending.attackerBucket,
        defenderBucket,
        attackerHasCounterRider,
      });

      let p1 = battle.p1_current_hp ?? (battle.team_a as any).spider.hit_points;
      let p2 = battle.p2_current_hp ?? (battle.team_b as any).spider.hit_points;
      const nextTurnIndex = turnIndex + 1;
      const defenderHp = attackerIsP1 ? p2 : p1;
      const damage = capDamageForTurn(result.damage, defenderHp, turnIndex, nextTurnIndex > MIN_TURNS);
      if (attackerIsP1) p2 = Math.max(0, p2 - damage);
      else p1 = Math.max(0, p1 - damage);

      await supabase.from("battle_turns").insert({
        battle_id: battle.id,
        turn_index: turnIndex,
        actor_user_id: attackerId,
        action_type: attackerStance === "venom_bite" ? "special" : "attack",
        action_payload: {
          attackerBucket: pending.attackerBucket,
          defenderBucket,
          attackStance: attackerStance,
          defenseStance: defenderStance,
        },
        result_payload: {
          action: attackerStance === "venom_bite" ? "special" : "attack",
          damage,
          bonus_damage: result.bonusDamage,
          new_defender_hp: attackerIsP1 ? p2 : p1,
          attacker_name: attacker.nickname,
          defender_name: defender.nickname,
          is_critical: result.isCritical,
          dodged: result.dodged,
          attacker_dice: result.attackerDice,
          defender_dice: result.defenderDice,
          attacker_bucket: pending.attackerBucket,
          defender_bucket: defenderBucket,
          attack_stance: attackerStance,
          defense_stance: defenderStance,
          breakdown: result.breakdown,
        },
      });

      const someoneKO = (p1 <= 0 || p2 <= 0);
      const reachedMin = nextTurnIndex > MIN_TURNS;
      const reachedMax = nextTurnIndex > MAX_TURNS;
      const finished = reachedMax || (someoneKO && reachedMin);
      const newRider = result.defenderEarnsCounterRider ? defenderId : undefined;

      const updates: any = {
        p1_current_hp: p1,
        p2_current_hp: p2,
        turn_count: turnIndex,
      };

      if (finished) {
        let winner: "A" | "B"; let winnerUser: string;
        if (p1 > p2) { winner = "A"; winnerUser = teamAUser; }
        else if (p2 > p1) { winner = "B"; winnerUser = teamBUser; }
        else {
          const aP = (battle.team_a as any).spider.power_score;
          const bP = (battle.team_b as any).spider.power_score;
          winner = aP >= bP ? "A" : "B";
          winnerUser = winner === "A" ? teamAUser : teamBUser;
        }
        const loserUser = winnerUser === teamAUser ? teamBUser : teamAUser;
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
        return new Response(JSON.stringify({ success: true, finished: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Next round: the defender becomes the next attacker (alternating).
      const nextAttackerId = defenderId;
      const newPending = {
        attackerId: nextAttackerId,
        attackerBucket: undefined,
        defenderBucket: undefined,
        turnIndex: nextTurnIndex,
        counterRiderFor: newRider,
      };
      updates.awaiting_action = "attack";
      updates.awaiting_user_id = nextAttackerId;
      updates.current_turn_user_id = nextAttackerId;
      updates.battle_log = { pending: newPending, lastRider: newRider ?? null };
      await supabase.from("battles").update(updates).eq("id", battle.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("battle-opponent-turn error:", error);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
