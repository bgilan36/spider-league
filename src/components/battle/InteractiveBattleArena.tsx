import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, Trophy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useTurnBasedBattle } from "@/hooks/useTurnBasedBattle";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SkillMeter from "./SkillMeter";
import DiceDisplay from "./DiceDisplay";
import { invalidatePodStandings } from "@/hooks/usePodStandings";
import {
  ATTACK_STANCE_META, DEFENSE_STANCE_META,
  type ZoneBucket, type AttackStance, type DefenseStance, BUCKET_LABEL,
} from "@/lib/battle/stances";

interface Props { battleId: string }

// Mirrors underdogZoneBoost on the server.
function underdogBoost(myPower: number, oppPower: number) {
  if (oppPower <= myPower) return 0;
  const gap = (oppPower - myPower) / Math.max(1, myPower);
  return Math.min(0.5, gap);
}

export default function InteractiveBattleArena({ battleId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { battle, turns, loading, myHp, opponentHp, mySpider, opponentSpider } =
    useTurnBasedBattle(battleId);
  const [submitting, setSubmitting] = useState(false);
  const [aiTriggered, setAiTriggered] = useState<string>("");

  const awaitingAction = (battle as any)?.awaiting_action as "attack" | "defense" | null;
  const awaitingUser = (battle as any)?.awaiting_user_id as string | null;
  const myStances = useMemo(() => {
    const s = (battle as any)?.stances || {};
    return user ? s[user.id] : null;
  }, [battle, user]);

  const isMyMove = !!user && awaitingUser === user.id;
  const opponentUserId = useMemo(() => {
    if (!battle || !user) return null;
    const a = (battle.team_a as any)?.userId;
    const b = (battle.team_b as any)?.userId;
    return user.id === a ? b : a;
  }, [battle, user]);

  // If it's the AI's move, ask the server to play it.
  useEffect(() => {
    if (!battle?.is_active || !awaitingUser || !user) return;
    if (awaitingUser === user.id) return;
    const key = `${battleId}:${battle.turn_count}:${awaitingAction}:${awaitingUser}`;
    if (aiTriggered === key) return;
    setAiTriggered(key);
    supabase.functions.invoke("battle-opponent-turn", { body: { battleId } })
      .catch((e) => console.error("opponent turn error", e));
  }, [battle?.is_active, battle?.turn_count, awaitingUser, awaitingAction, user, battleId, aiTriggered]);

  const submitBucket = async (bucket: ZoneBucket) => {
    if (!battle || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("battle-turn", {
        body: { battleId, bucket },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit action");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !battle || !mySpider || !opponentSpider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const finished = !battle.is_active;
  const winnerId = (battle.winner as string | null) === "A"
    ? (battle.team_a as any).userId
    : (battle.winner as string | null) === "B"
      ? (battle.team_b as any).userId
      : null;
  const iWon = !!winnerId && winnerId === user?.id;

  const lastTurn = turns[turns.length - 1];
  const lastResult = (lastTurn?.result_payload || {}) as any;

  const myPower = mySpider.power_score;
  const oppPower = opponentSpider.power_score;
  const myZoneBoost = underdogBoost(myPower, oppPower);
  const returnPath = (battle as any)?.league_id
    ? `/leagues/${(battle as any).league_id}`
    : "/";

  // Helper: identify whether the pending attack belongs to me or opponent (for defense framing)
  const log = (battle as any)?.battle_log as any;
  const pending = log?.pending;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet><title>Skill Battle | Spider League</title></Helmet>

      <div className="max-w-3xl mx-auto p-4">
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link to={returnPath}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>

        {/* Spider headers */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <img src={mySpider.image_url} alt={mySpider.nickname} className="w-12 h-12 rounded object-cover" />
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">{mySpider.nickname}</div>
                  <div className="text-xs text-muted-foreground">Power {mySpider.power_score}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Heart className="h-3 w-3 text-red-500" />
                <Progress value={Math.max(0, ((myHp ?? 0) / mySpider.hit_points) * 100)} className="h-2" />
                <span className="tabular-nums">{myHp}/{mySpider.hit_points}</span>
              </div>
              {myStances && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    Atk: {ATTACK_STANCE_META[myStances.attack as AttackStance]?.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Def: {DEFENSE_STANCE_META[myStances.defense as DefenseStance]?.label}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <img src={opponentSpider.image_url} alt={opponentSpider.nickname} className="w-12 h-12 rounded object-cover" />
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">{opponentSpider.nickname}</div>
                  <div className="text-xs text-muted-foreground">Power {opponentSpider.power_score}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Heart className="h-3 w-3 text-red-500" />
                <Progress value={Math.max(0, ((opponentHp ?? 0) / opponentSpider.hit_points) * 100)} className="h-2" />
                <span className="tabular-nums">{opponentHp}/{opponentSpider.hit_points}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last turn recap */}
        {lastTurn && (
          <Card className="mb-4">
            <CardContent className="p-3 text-sm">
              <div className="font-semibold mb-1">
                Turn {lastTurn.turn_index} — {lastResult.attacker_name} → {lastResult.defender_name}
              </div>
              <div className="flex items-center justify-center gap-6 my-3">
                <div className="flex flex-col items-center">
                  <DiceDisplay
                    value={lastResult.attacker_dice}
                    label={`${lastResult.attacker_name} attack`}
                    variant="attack"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {BUCKET_LABEL[lastResult.attacker_bucket as ZoneBucket]}
                  </span>
                </div>
                <span className="text-xl font-bold text-muted-foreground">vs</span>
                <div className="flex flex-col items-center">
                  <DiceDisplay
                    value={lastResult.defender_dice}
                    label={`${lastResult.defender_name} defense`}
                    variant="defense"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {BUCKET_LABEL[lastResult.defender_bucket as ZoneBucket]}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-center">
                {lastResult.dodged
                  ? <span className="text-emerald-400 font-semibold">Dodged!</span>
                  : <span>
                      Damage: <span className="font-bold text-red-400">{lastResult.damage}</span>
                      {lastResult.is_critical && <span className="ml-2 text-yellow-400 font-bold">CRIT</span>}
                    </span>}
              </div>
              {Array.isArray(lastResult.breakdown) && (
                <ul className="mt-2 text-[11px] text-muted-foreground list-disc pl-4">
                  {lastResult.breakdown.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action area */}
        {!finished && (
          <Card>
            <CardContent className="p-4">
              {isMyMove ? (
                awaitingAction === "attack" ? (
                  <SkillMeter
                    key={`atk-${battle.turn_count}-${awaitingUser}`}
                    label="Your attack"
                    helper="Lock inside the green Skill Zone to bias your dice high. Yellow center = Perfect."
                    zoneBoost={myZoneBoost}
                    disabled={submitting}
                    onLock={submitBucket}
                  />
                ) : (
                  <SkillMeter
                    key={`def-${battle.turn_count}-${awaitingUser}`}
                    label="Defend the incoming hit"
                    helper={
                      pending
                        ? `${opponentSpider.nickname} attacked with ${BUCKET_LABEL[pending.attackerBucket as ZoneBucket]}. Time your defense!`
                        : "Time your defense!"
                    }
                    zoneBoost={myZoneBoost}
                    disabled={submitting}
                    onLock={submitBucket}
                  />
                )
              ) : (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {awaitingAction === "attack"
                    ? `${opponentSpider.nickname} is choosing an attack…`
                    : `${opponentSpider.nickname} is bracing for your hit…`}
                </div>
              )}
              <div className="text-xs text-muted-foreground text-center mt-3">
                Round {(battle.turn_count || 0) + (awaitingAction ? 1 : 0)} · max 12
              </div>
            </CardContent>
          </Card>
        )}

        {finished && (
          <Card className="mt-4">
            <CardContent className="p-6 text-center space-y-3">
              <Trophy className={`h-10 w-10 mx-auto ${iWon ? "text-yellow-400" : "text-muted-foreground"}`} />
              <div className="text-2xl font-bold">{iWon ? "Victory!" : "Defeat"}</div>
              <div className="text-sm text-muted-foreground">
                {iWon ? mySpider.nickname : opponentSpider.nickname} wins after {battle.turn_count} rounds.
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <Button onClick={() => navigate(returnPath)} variant="default">Done</Button>
                <Button onClick={() => navigate("/battle-history")} variant="outline">Battle history</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
