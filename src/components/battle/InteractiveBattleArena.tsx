import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTurnBasedBattle } from "@/hooks/useTurnBasedBattle";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SkillMeter from "./SkillMeter";
import DiceDisplay from "./DiceDisplay";
import ShareButton from "@/components/ShareButton";
import { generateBattleShareImage } from "@/lib/battleShareImage";
import { ensureShareCard } from "@/lib/ensureShareCard";
import { useConfetti } from "@/hooks/useConfetti";
import { invalidatePodStandings } from "@/hooks/usePodStandings";
import {
  ATTACK_STANCE_META, DEFENSE_STANCE_META,
  type ZoneBucket, type AttackStance, type DefenseStance, BUCKET_LABEL,
} from "@/lib/battle/stances";
import CombatStage from "./combat/CombatStage";
import type { CombatEvent } from "./combat/combatFx";

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
  const { fireConfetti } = useConfetti();
  const [celebrated, setCelebrated] = useState(false);

  // On mobile the browser often restores scroll or keeps you mid-page after
  // navigating in from a modal. Force the arena to open at the top so the
  // HP bars and the skill-meter/dice roll are visible above the fold.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [battleId]);

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

  const finished = !!battle && !battle.is_active;
  const winnerId = battle
    ? (battle.winner as string | null) === "A"
      ? (battle.team_a as any).userId
      : (battle.winner as string | null) === "B"
        ? (battle.team_b as any).userId
        : null
    : null;
  const iWon = !!winnerId && winnerId === user?.id;

  // Derive a CombatEvent for every completed turn so the arena plays it.
  // Memoized by length so new turns simply append.
  const events = useMemo<CombatEvent[]>(() => {
    if (!mySpider || !opponentSpider) return [];
    const list: CombatEvent[] = [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i] as any;
      const r = t?.result_payload || {};
      const isMine = r.attacker_name === mySpider.nickname;
      const isLast = i === turns.length - 1;
      list.push({
        attacker: isMine ? "me" : "opp",
        damage: Math.max(0, Number(r.damage) || 0),
        crit: !!r.is_critical,
        dodged: !!r.dodged,
        finisher: isLast && finished,
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, finished, mySpider?.nickname, opponentSpider?.nickname]);

  useEffect(() => {
    if (finished && iWon && !celebrated) {
      setCelebrated(true);
      fireConfetti("victory");
    }
  }, [finished, iWon, celebrated, fireConfetti]);

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

  // When the battle finishes inside a pod, bust the standings cache so the
  // pod page shows fresh numbers as soon as the user navigates back.
  useEffect(() => {
    if (!battle) return;
    const leagueId = (battle as any)?.league_id;
    if (!leagueId) return;
    if (battle.is_active === false) {
      invalidatePodStandings(leagueId);
    }
  }, [battle?.is_active, (battle as any)?.league_id]);

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

      <div className="max-w-3xl mx-auto p-3 sm:p-4">
        <Button variant="ghost" size="sm" asChild className="mb-2 sm:mb-3 -ml-2 h-8">
          <Link to={returnPath}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>

        {/* Cinematic combat arena */}
        <div className="mb-3 sm:mb-4">
          <CombatStage
            me={{
              name: mySpider.nickname,
              imageUrl: mySpider.image_url,
              maxHp: mySpider.hit_points,
              stats: {
                damage: mySpider.damage, speed: mySpider.speed,
                venom: mySpider.venom,   webcraft: mySpider.webcraft,
              },
            }}
            opp={{
              name: opponentSpider.nickname,
              imageUrl: opponentSpider.image_url,
              maxHp: opponentSpider.hit_points,
              stats: {
                damage: opponentSpider.damage, speed: opponentSpider.speed,
                venom: opponentSpider.venom,   webcraft: opponentSpider.webcraft,
              },
            }}
            myHp={myHp ?? mySpider.hit_points}
            oppHp={opponentHp ?? opponentSpider.hit_points}
            events={events}
          />
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
        </div>

        {/* Action area — kept close to the HP meters for quick rolling */}
        {!finished && (
          <Card className="mb-4">
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

        {/* Last turn recap */}
        {lastTurn && (
          <Card className="mb-4">
            <CardContent className="p-3 text-sm">
              <div className="font-semibold mb-1">
                Turn {lastTurn.turn_index} — {lastResult.attacker_name} → {lastResult.defender_name}
              </div>
              {(() => {
                // Spider headers above are laid out as [mine | opponent].
                // Align each dice column to its matching spider so HP and
                // dice for the same spider live in the same vertical stack.
                const myIsAttacker = lastResult.attacker_name === mySpider.nickname;
                const mineDice = myIsAttacker
                  ? { value: lastResult.attacker_dice, label: `${mySpider.nickname} attack`, variant: "attack" as const, bucket: lastResult.attacker_bucket }
                  : { value: lastResult.defender_dice, label: `${mySpider.nickname} defense`, variant: "defense" as const, bucket: lastResult.defender_bucket };
                const oppDice = myIsAttacker
                  ? { value: lastResult.defender_dice, label: `${opponentSpider.nickname} defense`, variant: "defense" as const, bucket: lastResult.defender_bucket }
                  : { value: lastResult.attacker_dice, label: `${opponentSpider.nickname} attack`, variant: "attack" as const, bucket: lastResult.attacker_bucket };
                return (
                  <div className="grid grid-cols-2 gap-3 my-3 items-start">
                    <div className="flex flex-col items-center">
                      <DiceDisplay value={mineDice.value} label={mineDice.label} variant={mineDice.variant} />
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {BUCKET_LABEL[mineDice.bucket as ZoneBucket]}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <DiceDisplay value={oppDice.value} label={oppDice.label} variant={oppDice.variant} />
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {BUCKET_LABEL[oppDice.bucket as ZoneBucket]}
                      </span>
                    </div>
                  </div>
                );
              })()}
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

        {finished && (
          <Card className="mt-4">
            <CardContent className="p-6 text-center space-y-3">
              <Trophy className={`h-10 w-10 mx-auto ${iWon ? "text-yellow-400" : "text-muted-foreground"}`} />
              <div className="text-2xl font-bold">{iWon ? "Victory!" : "Defeat"}</div>
              <div className="text-sm text-muted-foreground">
                {iWon ? mySpider.nickname : opponentSpider.nickname} wins after {battle.turn_count} rounds.
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Button onClick={() => navigate(returnPath)} variant="default">Done</Button>
                <Button onClick={() => navigate("/battle-history")} variant="outline">Battle history</Button>
                <ShareButton
                  variant="outline"
                  size="default"
                  title={iWon ? "I won my Spider League battle!" : "My Spider League battle just ended"}
                  text={
                    iWon
                      ? `🏆 ${mySpider.nickname} defeated ${opponentSpider.nickname} in ${battle.turn_count} rounds on Spider League!`
                      : `🕷️ ${opponentSpider.nickname} beat my ${mySpider.nickname} in ${battle.turn_count} rounds on Spider League. Time for a rematch!`
                  }
                  url={`${window.location.origin}/battle/${battle.id}`}
                  imageFileName={`spider-league-${iWon ? "win" : "loss"}-${battle.id.slice(0, 8)}.png`}
                  getShareImage={() =>
                    generateBattleShareImage({
                      iWon,
                      rounds: battle.turn_count || 0,
                      winnerName: iWon ? mySpider.nickname : opponentSpider.nickname,
                      winnerImageUrl: iWon ? mySpider.image_url : opponentSpider.image_url,
                      loserName: iWon ? opponentSpider.nickname : mySpider.nickname,
                      loserImageUrl: iWon ? opponentSpider.image_url : mySpider.image_url,
                      tagline: "Upload your spider. Battle for glory. spiderleague.app",
                    })
                  }
                  prepareShareUrl={async () => {
                    const { shareUrl } = await ensureShareCard({
                      kind: "battle",
                      id: battle.id,
                      existingImageUrl: (battle as any).share_image_url ?? null,
                      generate: () =>
                        generateBattleShareImage({
                          iWon: true, // store the winner's perspective
                          rounds: battle.turn_count || 0,
                          winnerName: iWon ? mySpider.nickname : opponentSpider.nickname,
                          winnerImageUrl: iWon ? mySpider.image_url : opponentSpider.image_url,
                          loserName: iWon ? opponentSpider.nickname : mySpider.nickname,
                          loserImageUrl: iWon ? opponentSpider.image_url : mySpider.image_url,
                          tagline: "Spider League — spiderleague.app",
                        }),
                    });
                    return shareUrl;
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
