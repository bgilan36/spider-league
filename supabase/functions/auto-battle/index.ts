import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BattleState {
  p1_hp: number;
  p2_hp: number;
  turns: any[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { battleId } = await req.json();

    // Fetch battle details
    const { data: battle, error: battleError } = await supabase
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .single();

    if (battleError) throw battleError;

    const spider1 = battle.team_a.spider;
    const spider2 = battle.team_b.spider;
    const user1 = battle.team_a.userId;
    const user2 = battle.team_b.userId;

    // Initialize battle state
    const state: BattleState = {
      p1_hp: spider1.hit_points,
      p2_hp: spider2.hit_points,
      turns: [],
    };

    let turnCount = 0;
    let currentTurnUser = user1;
    const maxTurns = 30; // Reduced for faster battles

    // Dice roll function (1-20)
    const rollDice = () => Math.floor(Math.random() * 20) + 1;

    // Run battle simulation
    while (state.p1_hp > 0 && state.p2_hp > 0 && turnCount < maxTurns) {
      turnCount++;
      const isP1Turn = currentTurnUser === user1;
      const attacker = isP1Turn ? spider1 : spider2;
      const defender = isP1Turn ? spider2 : spider1;
      const attackerHp = isP1Turn ? state.p1_hp : state.p2_hp;
      const defenderHp = isP1Turn ? state.p2_hp : state.p1_hp;

      // Roll dice for both attacker and defender
      const attackerDice = rollDice();
      const defenderDice = rollDice();
      
      // Choose action (85% attack, 15% special)
      const rand = Math.random();
      let actionType: string;
      let damage = 0;
      let isCritical = false;

      if (rand < 0.85) {
        actionType = "attack";
        // Base damage calculation with dice modifier
        const baseDamage = attacker.damage + (attackerDice - 10); // Dice adds -9 to +10
        const defense = Math.floor(defender.defense / 10) + (defenderDice > 15 ? 3 : 0); // High defender roll adds defense
        damage = Math.max(1, baseDamage - defense);
        
        // Critical hit on natural 20
        if (attackerDice === 20) {
          damage = Math.floor(damage * 1.5);
          isCritical = true;
        }
      } else {
        actionType = "special";
        // Special attacks are more powerful but less consistent
        const baseDamage = attacker.venom + (attackerDice - 8); // Higher variance
        const defense = Math.floor(defender.defense / 8) + (defenderDice > 16 ? 2 : 0);
        damage = Math.max(2, baseDamage - defense);
        
        // Critical on 19-20 for special
        if (attackerDice >= 19) {
          damage = Math.floor(damage * 1.75);
          isCritical = true;
        }
      }

      const newDefenderHp = Math.max(0, defenderHp - damage);

      // Update state
      if (isP1Turn) {
        state.p2_hp = newDefenderHp;
      } else {
        state.p1_hp = newDefenderHp;
      }

      // Determine special move description
      let specialMoveDescription = "";
      if (actionType === "special" && attacker.special_attacks && Array.isArray(attacker.special_attacks) && attacker.special_attacks.length > 0) {
        const randomSpecial = attacker.special_attacks[Math.floor(Math.random() * attacker.special_attacks.length)];
        specialMoveDescription = randomSpecial.name || "Venom Strike";
      }

      // Record turn
      const turnResult = {
        turn_index: turnCount,
        actor_user_id: currentTurnUser,
        action_type: actionType,
        action_payload: {},
        result_payload: {
          action: actionType,
          damage: damage,
          new_defender_hp: newDefenderHp,
          attacker_hp: attackerHp,
          attacker_name: attacker.nickname,
          defender_name: defender.nickname,
          special_move: specialMoveDescription,
          old_defender_hp: defenderHp,
          attacker_dice: attackerDice,
          defender_dice: defenderDice,
          is_critical: isCritical,
        },
      };

      state.turns.push(turnResult);

      // Insert turn into database
      await supabase.from("battle_turns").insert({
        battle_id: battleId,
        ...turnResult,
      });

      // Reduced delay for faster battles (aim for ~15 seconds total with max 30 turns)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Switch turn
      currentTurnUser = currentTurnUser === user1 ? user2 : user1;
    }

    // Determine winner
    let winner: string;
    let winnerUser: string;

    if (state.p1_hp > state.p2_hp) {
      winner = "A";
      winnerUser = user1;
    } else if (state.p2_hp > state.p1_hp) {
      winner = "B";
      winnerUser = user2;
    } else {
      // Tie - highest power score wins
      winner = spider1.power_score >= spider2.power_score ? "A" : "B";
      winnerUser = winner === "A" ? user1 : user2;
    }

    const loserUser = winnerUser === user1 ? user2 : user1;

    // Update battle as complete
    await supabase
      .from("battles")
      .update({
        winner: winner,
        is_active: false,
        turn_count: turnCount,
        p1_current_hp: state.p1_hp,
        p2_current_hp: state.p2_hp,
      })
      .eq("id", battleId);

    // If linked to challenge, resolve it
    if (battle.challenge_id) {
      const loserSpider = winnerUser === user1 ? spider2 : spider1;

      // Transfer spider ownership
      await supabase
        .from("spiders")
        .update({ owner_id: winnerUser })
        .eq("id", loserSpider.id);

      // Update challenge
      await supabase
        .from("battle_challenges")
        .update({
          status: "COMPLETED",
          battle_id: battleId,
          winner_id: winnerUser,
          loser_spider_id: loserSpider.id,
        })
        .eq("id", battle.challenge_id);

      // Award badges
      await supabase.rpc("award_badges_for_user", {
        user_id_param: winnerUser,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        battleId,
        winner: winnerUser,
        turns: state.turns.length,
        finalState: {
          p1_hp: state.p1_hp,
          p2_hp: state.p2_hp,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Auto-battle error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
