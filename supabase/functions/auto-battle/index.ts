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
    const minTurns = 4; // Minimum 4 turns for excitement
    const maxTurns = 12; // Max 12 turns to ensure battle doesn't drag

    // Dice roll function (1-20)
    const rollDice = () => Math.floor(Math.random() * 20) + 1;

    // Run battle simulation
    while ((state.p1_hp > 0 && state.p2_hp > 0 && turnCount < maxTurns) || turnCount < minTurns) {
      turnCount++;
      const isP1Turn = currentTurnUser === user1;
      const attacker = isP1Turn ? spider1 : spider2;
      const defender = isP1Turn ? spider2 : spider1;
      const attackerHp = isP1Turn ? state.p1_hp : state.p2_hp;
      const defenderHp = isP1Turn ? state.p2_hp : state.p1_hp;

      // Roll dice for both attacker and defender
      const attackerDice = rollDice();
      const defenderDice = rollDice();
      
      // Choose action (75% attack, 25% special for more excitement)
      const rand = Math.random();
      let actionType: string;
      let damage = 0;
      let isCritical = false;
      let dodged = false;

      if (rand < 0.75) {
        actionType = "attack";
        // Scale damage based on turn count to ensure minimum turns
        const turnModifier = turnCount < minTurns ? 0.5 : 1.0;
        const baseDamage = Math.floor(attacker.damage * 1.8 * turnModifier) + (attackerDice - 10);
        const defense = Math.floor(defender.defense / 18) + (defenderDice > 17 ? 2 : 0);
        
        // Dodge on defender rolling 19-20 and attacker not rolling 20
        if (defenderDice >= 19 && attackerDice < 20) {
          damage = 0;
          dodged = true;
        } else {
          damage = Math.max(5, baseDamage - defense); // Minimum 5 damage
          
          // Critical hit on natural 20
          if (attackerDice === 20) {
            damage = Math.floor(damage * 2.5);
            isCritical = true;
          }
        }
      } else {
        actionType = "special";
        // Special attacks - more powerful
        const turnModifier = turnCount < minTurns ? 0.6 : 1.0;
        const baseDamage = Math.floor(attacker.venom * 2.0 * turnModifier) + (attackerDice - 8);
        const defense = Math.floor(defender.defense / 15) + (defenderDice > 18 ? 2 : 0);
        
        // Dodge on defender rolling 20
        if (defenderDice === 20 && attackerDice < 19) {
          damage = 0;
          dodged = true;
        } else {
          damage = Math.max(8, baseDamage - defense); // Minimum 8 damage
          
          // Critical on 19-20 for special
          if (attackerDice >= 19) {
            damage = Math.floor(damage * 3.0);
            isCritical = true;
          }
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
          dodged: dodged,
        },
      };

      state.turns.push(turnResult);

      // Insert turn into database
      await supabase.from("battle_turns").insert({
        battle_id: battleId,
        ...turnResult,
      });

      // Quick delay for real-time display (2 seconds per turn for suspense)
      await new Promise(resolve => setTimeout(resolve, 2000));

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

      console.log('Transferring spider ownership:', {
        spiderId: loserSpider.id,
        fromUser: loserSpider.owner_id,
        toUser: winnerUser
      });

      // Transfer spider ownership using the secure database function
      const { error: transferError } = await supabase.rpc('transfer_spider_ownership', {
        spider_id: loserSpider.id,
        new_owner_id: winnerUser
      });

      if (transferError) {
        console.error('Spider transfer error:', transferError);
        throw new Error(`Failed to transfer spider: ${transferError.message}`);
      }

      console.log('Spider transferred successfully');

      // Update challenge
      const { error: challengeError } = await supabase
        .from("battle_challenges")
        .update({
          status: "COMPLETED",
          battle_id: battleId,
          winner_id: winnerUser,
          loser_spider_id: loserSpider.id,
        })
        .eq("id", battle.challenge_id);

      if (challengeError) {
        console.error('Challenge update error:', challengeError);
        throw new Error(`Failed to update challenge: ${challengeError.message}`);
      }

      // Award badges
      const { error: badgeError } = await supabase.rpc("award_badges_for_user", {
        user_id_param: winnerUser,
      });

      if (badgeError) {
        console.error('Badge award error:', badgeError);
        // Don't throw here, badges are not critical
      }
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
