import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Info, Loader2, PlayCircle, RefreshCcw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { useConfetti } from "@/hooks/useConfetti";
import { pickEvenlyMatchedOpponent } from "@/lib/spiderSkirmishUtils.js";

type SkirmishSpider = {
  id: string;
  owner_id: string;
  owner_display_name?: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
};

type SkirmishSuggestion = {
  available: boolean;
  reason?: string;
  range_used?: number;
  matchup_score?: number;
  daily_limit?: number;
  skirmishes_used_today?: number;
  skirmishes_remaining_today?: number;
  player_spider?: SkirmishSpider;
  opponent_spider?: SkirmishSpider;
};

type SkirmishTurn = {
  turn: number;
  attacker_side: "A" | "B";
  attacker_id: string;
  defender_id: string;
  damage: number;
  attacker_hp: number;
  defender_hp: number;
  crit: boolean;
};

type SkirmishResult = {
  skirmish_id: string;
  created_at: string;
  matchup_score: number;
  player_spider: SkirmishSpider;
  opponent_spider: SkirmishSpider;
  winner_side: "A" | "B";
  winner_spider_id: string;
  turn_log: SkirmishTurn[];
  rewards: {
    xp_gain: number;
    new_xp?: number | null;
    new_level?: number | null;
    stat_improvements?: Record<string, number>;
  };
  idempotent_replay: boolean;
};

const DAILY_SKIRMISH_LIMIT = 3;

const getPacificDayBounds = () => {
  // Get current time in Pacific timezone
  const now = new Date();
  const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = pacificFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);

  // Build midnight PT as a Date by computing the PT offset
  // Create a date at midnight UTC for that calendar date, then adjust
  const midnightUtcGuess = new Date(Date.UTC(year, month, day, 12, 0, 0)); // noon UTC to safely format
  const ptString = midnightUtcGuess.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const ptNoon = new Date(ptString);
  const offsetMs = midnightUtcGuess.getTime() - ptNoon.getTime();

  // Midnight PT in UTC = calendar date midnight + offset
  const dayStartUtc = new Date(Date.UTC(year, month, day) + offsetMs);
  const nextDayStartUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  return {
    startIso: dayStartUtc.toISOString(),
    endIso: nextDayStartUtc.toISOString(),
  };
};

const isDailyLimitMessage = (message: string | null | undefined) => {
  const normalized = String(message ?? "").toLowerCase();
  return normalized.includes("daily skirmish limit");
};

const formatStatLabel = (key: string) =>
  key
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const mapSpiderToSkirmish = (spider: any, ownerDisplayName?: string): SkirmishSpider => ({
  id: spider.id,
  owner_id: spider.owner_id,
  owner_display_name: ownerDisplayName,
  nickname: spider.nickname,
  species: spider.species,
  image_url: spider.image_url,
  power_score: spider.power_score ?? 0,
  hit_points: spider.hit_points ?? 0,
  damage: spider.damage ?? 0,
  speed: spider.speed ?? 0,
  defense: spider.defense ?? 0,
  venom: spider.venom ?? 0,
  webcraft: spider.webcraft ?? 0,
});

const createEvenMatchSuggestion = (
  playerSpider: SkirmishSpider | null,
  opponentSpiders: SkirmishSpider[],
): SkirmishSuggestion => {
  if (!playerSpider) {
    return { available: false, reason: "No spiders found in your collection." };
  }

  if (!opponentSpiders.length) {
    return { available: false, reason: "No opponent spiders available right now." };
  }

  const normalizedPlayer = {
    id: playerSpider.id,
    ownerId: playerSpider.owner_id,
    powerScore: playerSpider.power_score,
    damage: playerSpider.damage,
    webcraft: playerSpider.webcraft,
    defense: playerSpider.defense,
    speed: playerSpider.speed,
    venom: playerSpider.venom,
    approved: true,
  };

  const normalizedOpponents = opponentSpiders.map((spider) => ({
    id: spider.id,
    ownerId: spider.owner_id,
    powerScore: spider.power_score,
    damage: spider.damage,
    webcraft: spider.webcraft,
    defense: spider.defense,
    speed: spider.speed,
    venom: spider.venom,
    approved: true,
  }));

  const match = pickEvenlyMatchedOpponent(normalizedPlayer, normalizedOpponents);
  if (!match.opponent) {
    return { available: false, reason: "No evenly matched rival available right now." };
  }

  const pickedOpponent = opponentSpiders.find((spider) => spider.id === match.opponent?.id);
  if (!pickedOpponent) {
    return { available: false, reason: "Could not find a rival for this skirmish." };
  }

  return {
    available: true,
    range_used: match.usedBand ?? undefined,
    matchup_score: match.score ?? undefined,
    player_spider: playerSpider,
    opponent_spider: pickedOpponent,
  };
};

const isMissingSkirmishRpc = (error: unknown) => {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  const details = String((error as { details?: string } | null)?.details ?? "").toLowerCase();
  const code = String((error as { code?: string } | null)?.code ?? "").toUpperCase();
  return (
    code === "PGRST202" ||
    message.includes("could not find the function public.start_spider_skirmish") ||
    details.includes("could not find the function public.start_spider_skirmish")
  );
};

const hashToPositiveInt = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const resolveClientSideSkirmish = (
  playerSpider: SkirmishSpider,
  opponentSpider: SkirmishSpider,
  matchupScore?: number,
): SkirmishResult => {
  const seed =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const turnLog: SkirmishTurn[] = [];

  let playerHp = playerSpider.hit_points;
  let opponentHp = opponentSpider.hit_points;

  let attackerSide: "A" | "B";
  if (playerSpider.speed === opponentSpider.speed) {
    attackerSide = hashToPositiveInt(`${seed}:first`) % 2 === 0 ? "A" : "B";
  } else {
    attackerSide = playerSpider.speed > opponentSpider.speed ? "A" : "B";
  }

  for (let turn = 1; turn <= 25; turn += 1) {
    if (playerHp <= 0 || opponentHp <= 0) break;

    const rollHash = hashToPositiveInt(`${seed}:${turn}:${attackerSide}:roll`);
    const critHash = hashToPositiveInt(`${seed}:${turn}:${attackerSide}:crit`);
    const rollMod = (rollHash % 7) - 3;
    const isCrit = critHash % 100 < 8;

    if (attackerSide === "A") {
      const rawDamage = Math.round(
        playerSpider.damage * 0.65 +
          playerSpider.venom * 0.3 +
          playerSpider.speed * 0.25 -
          (opponentSpider.defense * 0.28 + opponentSpider.webcraft * 0.14),
      );
      const damage = Math.max(2, rawDamage + rollMod + (isCrit ? 3 : 0));
      opponentHp = Math.max(0, opponentHp - damage);

      turnLog.push({
        turn,
        attacker_side: "A",
        attacker_id: playerSpider.id,
        defender_id: opponentSpider.id,
        damage,
        attacker_hp: playerHp,
        defender_hp: opponentHp,
        crit: isCrit,
      });
    } else {
      const rawDamage = Math.round(
        opponentSpider.damage * 0.65 +
          opponentSpider.venom * 0.3 +
          opponentSpider.speed * 0.25 -
          (playerSpider.defense * 0.28 + playerSpider.webcraft * 0.14),
      );
      const damage = Math.max(2, rawDamage + rollMod + (isCrit ? 3 : 0));
      playerHp = Math.max(0, playerHp - damage);

      turnLog.push({
        turn,
        attacker_side: "B",
        attacker_id: opponentSpider.id,
        defender_id: playerSpider.id,
        damage,
        attacker_hp: opponentHp,
        defender_hp: playerHp,
        crit: isCrit,
      });
    }

    attackerSide = attackerSide === "A" ? "B" : "A";
  }

  let winnerSide: "A" | "B";
  if (playerHp === opponentHp) {
    winnerSide = playerSpider.power_score >= opponentSpider.power_score ? "A" : "B";
  } else {
    winnerSide = playerHp > opponentHp ? "A" : "B";
  }

  const playerWon = winnerSide === "A";
  const improvableStats = ["damage", "webcraft", "speed", "defense", "venom", "hit_points"] as const;
  const boostedStat = improvableStats[hashToPositiveInt(`${seed}:reward`) % improvableStats.length];

  return {
    skirmish_id: `local-${seed}`,
    created_at: new Date().toISOString(),
    matchup_score: matchupScore ?? 50,
    player_spider: playerSpider,
    opponent_spider: opponentSpider,
    winner_side: winnerSide,
    winner_spider_id: playerWon ? playerSpider.id : opponentSpider.id,
    turn_log: turnLog,
    rewards: {
      xp_gain: playerWon ? 12 : 0,
      new_xp: null,
      new_level: null,
      stat_improvements: playerWon ? { [boostedStat]: 1 } : {},
    },
    idempotent_replay: false,
  };
};

export const SpiderSkirmishCard = ({ embedded = false }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fireConfetti } = useConfetti();

  const [suggestionLoading, setSuggestionLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<SkirmishSuggestion | null>(null);
  const [startingSkirmish, setStartingSkirmish] = useState(false);
  const [result, setResult] = useState<SkirmishResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [visibleTurnCount, setVisibleTurnCount] = useState(0);
  const [celebratedSkirmishId, setCelebratedSkirmishId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSwapPanelOpen, setIsSwapPanelOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [playerSpiderOptions, setPlayerSpiderOptions] = useState<SkirmishSpider[]>([]);
  const [opponentSpiderPool, setOpponentSpiderPool] = useState<SkirmishSpider[]>([]);
  const [dailySkirmishUsage, setDailySkirmishUsage] = useState<{ used: number; limit: number }>({
    used: 0,
    limit: DAILY_SKIRMISH_LIMIT,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const fetchDailySkirmishUsage = useCallback(async () => {
    if (!user) return null;
    const { startIso, endIso } = getPacificDayBounds();

    const { count, error } = await supabase
      .from("spider_skirmishes")
      .select("id", { count: "exact", head: true })
      .eq("initiator_user_id", user.id)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (error) {
      return null;
    }

    const used = count ?? 0;
    const usage = { used, limit: DAILY_SKIRMISH_LIMIT };
    setDailySkirmishUsage(usage);
    return usage;
  }, [user]);

  const fetchSpiderPools = useCallback(async () => {
    if (!user) return null;

    const { data: mySpiders, error: mySpidersError } = await supabase
      .from("spiders")
      .select("id, owner_id, nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(20);

    if (mySpidersError || !mySpiders || mySpiders.length === 0) {
      return null;
    }

    const playerSpiders = mySpiders.map((spider) => mapSpiderToSkirmish(spider));
    setPlayerSpiderOptions(playerSpiders);

    const { data: opponentSpiders, error: opponentError } = await supabase
      .from("spiders")
      .select("id, owner_id, nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved")
      .eq("is_approved", true)
      .neq("owner_id", user.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (opponentError || !opponentSpiders || opponentSpiders.length === 0) {
      return null;
    }

    const opponentOwnerIds = Array.from(new Set(opponentSpiders.map((spider) => spider.owner_id)));
    let ownerDisplayMap = new Map<string, string>();

    if (opponentOwnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", opponentOwnerIds);
      ownerDisplayMap = new Map(
        (profiles ?? [])
          .filter((profile) => !!profile.id)
          .map((profile) => [profile.id, profile.display_name || "Spider Trainer"]),
      );
    }

    const opponents = opponentSpiders.map((spider) =>
      mapSpiderToSkirmish(spider, ownerDisplayMap.get(spider.owner_id)),
    );
    setOpponentSpiderPool(opponents);

    return {
      playerSpiders,
      opponents,
    };
  }, [user]);

  const buildClientSideSuggestion = useCallback(async (preferredPlayerSpiderId?: string): Promise<SkirmishSuggestion | null> => {
    const pools = await fetchSpiderPools();
    if (!pools) return null;

    const selectedSpider =
      pools.playerSpiders.find((spider) => spider.id === preferredPlayerSpiderId) ??
      pools.playerSpiders[0] ??
      null;

    return createEvenMatchSuggestion(selectedSpider, pools.opponents);
  }, [fetchSpiderPools]);

  const handleSelectPlayerSpider = useCallback(async (playerSpiderId: string) => {
    let nextPlayerSpiders = playerSpiderOptions;
    let nextOpponents = opponentSpiderPool;

    if (!nextPlayerSpiders.length || !nextOpponents.length) {
      const pools = await fetchSpiderPools();
      if (!pools) return;
      nextPlayerSpiders = pools.playerSpiders;
      nextOpponents = pools.opponents;
    }

    const selectedSpider = nextPlayerSpiders.find((spider) => spider.id === playerSpiderId) ?? null;
    setSuggestion(createEvenMatchSuggestion(selectedSpider, nextOpponents));
    setIsSwapPanelOpen(false);
  }, [fetchSpiderPools, opponentSpiderPool, playerSpiderOptions]);

  const fetchSuggestion = useCallback(async () => {
    if (!user) return;
    setSuggestionLoading(true);
    const usage = await fetchDailySkirmishUsage();
    if (usage && usage.used >= usage.limit) {
      setSuggestion({
        available: false,
        reason: `Daily skirmish limit reached (${usage.limit} per day). Try again tomorrow.`,
        daily_limit: usage.limit,
        skirmishes_used_today: usage.used,
        skirmishes_remaining_today: 0,
      });
      setSuggestionLoading(false);
      return;
    }
    const localSuggestionPromise = buildClientSideSuggestion();

    try {
      const { data, error } = await supabase.rpc("get_spider_skirmish_suggestion");
      const serverSuggestion = !error && data ? (data as SkirmishSuggestion) : null;
      if (serverSuggestion?.available && serverSuggestion.player_spider && serverSuggestion.opponent_spider) {
        setSuggestion(serverSuggestion);
        await localSuggestionPromise;
        return;
      }

      if (serverSuggestion && !serverSuggestion.available && isDailyLimitMessage(serverSuggestion.reason)) {
        setSuggestion(serverSuggestion);
        await fetchDailySkirmishUsage();
        return;
      }

      const localSuggestion = await localSuggestionPromise;
      if (localSuggestion) {
        setSuggestion(localSuggestion);
        return;
      }

      setSuggestion({ available: false, reason: "Skirmish suggestion is temporarily unavailable." });
    } catch (error: any) {
      console.error("Failed to fetch skirmish suggestion", error);
      const localSuggestion = await localSuggestionPromise;
      setSuggestion(localSuggestion ?? { available: false, reason: "Skirmish suggestion is temporarily unavailable." });
    } finally {
      setSuggestionLoading(false);
    }
  }, [user, buildClientSideSuggestion, fetchDailySkirmishUsage]);

  useEffect(() => {
    fetchSuggestion();
  }, [fetchSuggestion]);

  const runClientSideSkirmish = useCallback(async () => {
    let selectedSuggestion = suggestion;
    if (!selectedSuggestion?.available || !selectedSuggestion.player_spider || !selectedSuggestion.opponent_spider) {
      selectedSuggestion = await buildClientSideSuggestion(suggestion?.player_spider?.id);
      if (selectedSuggestion) {
        setSuggestion(selectedSuggestion);
      }
    }

    if (!selectedSuggestion?.available || !selectedSuggestion.player_spider || !selectedSuggestion.opponent_spider) {
      throw new Error("No skirmish matchup is currently available.");
    }

    return resolveClientSideSkirmish(
      selectedSuggestion.player_spider,
      selectedSuggestion.opponent_spider,
      selectedSuggestion.matchup_score,
    );
  }, [buildClientSideSuggestion, suggestion]);

  const handleStartSkirmish = async () => {
    if (!user) return;

    setStartingSkirmish(true);
    try {
      const usage = await fetchDailySkirmishUsage();
      if (usage && usage.used >= usage.limit) {
        const dailyLimitMessage = `Daily skirmish limit reached (${usage.limit} per day). Try again tomorrow.`;
        setSuggestion({
          available: false,
          reason: dailyLimitMessage,
          daily_limit: usage.limit,
          skirmishes_used_today: usage.used,
          skirmishes_remaining_today: 0,
        });
        toast({
          title: "Skirmish limit reached",
          description: dailyLimitMessage,
          variant: "destructive",
        });
        return;
      }

      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      let parsedResult: SkirmishResult | null = null;
      let usedLocalFallback = false;

      const startWithArgs = await supabase.rpc("start_spider_skirmish", {
        p_player_spider_id: suggestion?.player_spider?.id ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (!startWithArgs.error && startWithArgs.data) {
        parsedResult = startWithArgs.data as SkirmishResult;
      } else if (isMissingSkirmishRpc(startWithArgs.error)) {
        const startWithoutArgs = await supabase.rpc("start_spider_skirmish");
        if (!startWithoutArgs.error && startWithoutArgs.data) {
          parsedResult = startWithoutArgs.data as SkirmishResult;
        } else if (isMissingSkirmishRpc(startWithoutArgs.error)) {
          parsedResult = await runClientSideSkirmish();
          usedLocalFallback = true;
        } else {
          throw startWithoutArgs.error;
        }
      } else {
        throw startWithArgs.error;
      }

      if (!parsedResult) {
        throw new Error("Skirmish could not be started.");
      }
      setResult(parsedResult);
      setModalOpen(true);
      setVisibleTurnCount(prefersReducedMotion ? parsedResult.turn_log.length : 0);
      await fetchDailySkirmishUsage();

      toast({
        title: "Spider Skirmish started",
        description: usedLocalFallback
          ? "Running a local battle preview while skirmish RPC is unavailable."
          : "Your battle replay is ready.",
      });
    } catch (error: any) {
      console.error("Failed to start skirmish", error);
      if (isDailyLimitMessage(error?.message)) {
        setSuggestion({
          available: false,
          reason: error.message,
          daily_limit: DAILY_SKIRMISH_LIMIT,
          skirmishes_used_today: DAILY_SKIRMISH_LIMIT,
          skirmishes_remaining_today: 0,
        });
      }
      toast({
        title: "Skirmish unavailable",
        description: error?.message || "Could not start Spider Skirmish right now.",
        variant: "destructive",
      });
    } finally {
      setStartingSkirmish(false);
    }
  };

  useEffect(() => {
    if (!modalOpen || !result) return;
    if (prefersReducedMotion) return;
    if (visibleTurnCount >= result.turn_log.length) return;

    const timer = window.setTimeout(() => {
      setVisibleTurnCount((current) => Math.min(current + 1, result.turn_log.length));
    }, 700);

    return () => window.clearTimeout(timer);
  }, [modalOpen, result, visibleTurnCount, prefersReducedMotion]);

  const replayState = useMemo(() => {
    if (!result) return null;

    let playerHp = result.player_spider.hit_points;
    let opponentHp = result.opponent_spider.hit_points;
    const shownTurns = result.turn_log.slice(0, visibleTurnCount);

    for (const turn of shownTurns) {
      if (turn.attacker_side === "A") {
        playerHp = turn.attacker_hp;
        opponentHp = turn.defender_hp;
      } else {
        opponentHp = turn.attacker_hp;
        playerHp = turn.defender_hp;
      }
    }

    return {
      playerHp,
      opponentHp,
      shownTurns,
      latestTurn: shownTurns[shownTurns.length - 1] ?? null,
      isComplete: visibleTurnCount >= result.turn_log.length,
    };
  }, [result, visibleTurnCount]);

  const currentUserWon =
    !!result &&
    !!result.player_spider &&
    result.winner_spider_id === result.player_spider.id &&
    result.rewards?.xp_gain > 0;
  const currentPlayerSpiderId = suggestion?.player_spider?.id ?? null;
  const winnerSpiderName =
    result && result.winner_spider_id === result.player_spider.id
      ? result.player_spider.nickname
      : result?.opponent_spider.nickname ?? "";
  const winnerTrainerName =
    result && result.winner_side === "A"
      ? "You"
      : result?.opponent_spider.owner_display_name || "The opposing trainer";
  const rewardStatEntries = Object.entries(result?.rewards?.stat_improvements ?? {});

  useEffect(() => {
    if (!result || !replayState?.isComplete) return;
    if (!currentUserWon) return;
    if (prefersReducedMotion) return;
    if (celebratedSkirmishId === result.skirmish_id) return;

    fireConfetti("victory");
    setCelebratedSkirmishId(result.skirmish_id);
  }, [result, replayState?.isComplete, currentUserWon, prefersReducedMotion, celebratedSkirmishId, fireConfetti]);

  const closeModal = async (isOpen: boolean) => {
    setModalOpen(isOpen);
    if (!isOpen) {
      setVisibleTurnCount(0);
      setResult(null);
      await fetchSuggestion();
    }
  };

  const skirmishProgress = result?.turn_log?.length
    ? Math.round((visibleTurnCount / result.turn_log.length) * 100)
    : 0;
  const skirmishesRemainingToday = Math.max(dailySkirmishUsage.limit - dailySkirmishUsage.used, 0);
  const dailyLimitReached = skirmishesRemainingToday <= 0;

  return (
    <>
      <Card className="glass-card border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl sm:text-2xl">Skirmishes</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsInfoOpen(true)}
              aria-label="What is Spider Skirmish?"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestionLoading ? (
            <div className="flex items-center gap-3 rounded-lg border border-border/50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finding your best skirmish matchup...</p>
            </div>
          ) : suggestion?.available && suggestion.player_spider && suggestion.opponent_spider ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Spider</p>
                    {playerSpiderOptions.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setIsSwapPanelOpen((current) => !current)}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Swap
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={suggestion.player_spider.image_url}
                      alt={suggestion.player_spider.nickname}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{suggestion.player_spider.nickname}</p>
                      <p className="truncate text-xs text-muted-foreground">{suggestion.player_spider.species}</p>
                      <p className="text-xs text-primary">Power {suggestion.player_spider.power_score}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested Rival</p>
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={suggestion.opponent_spider.image_url}
                      alt={suggestion.opponent_spider.nickname}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{suggestion.opponent_spider.nickname}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {suggestion.opponent_spider.species}
                        {suggestion.opponent_spider.owner_display_name
                          ? ` · ${suggestion.opponent_spider.owner_display_name}`
                          : ""}
                      </p>
                      <p className="text-xs text-primary">Power {suggestion.opponent_spider.power_score}</p>
                    </div>
                  </div>
                </div>
              </div>

              {playerSpiderOptions.length > 1 && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    isSwapPanelOpen ? "max-h-52 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Swap Your Spider</p>
                    <div className="flex flex-wrap gap-2">
                      {playerSpiderOptions.slice(0, 8).map((spider) => (
                        <Button
                          key={spider.id}
                          type="button"
                          size="sm"
                          variant={currentPlayerSpiderId === spider.id ? "default" : "outline"}
                          className="h-8 gap-2 px-2 text-xs"
                          onClick={() => handleSelectPlayerSpider(spider.id)}
                        >
                          <img src={spider.image_url} alt={spider.nickname} className="h-4 w-4 rounded object-cover" />
                          <span className="max-w-[110px] truncate">{spider.nickname}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                {typeof suggestion.matchup_score === "number" ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    Match Quality {Math.round(suggestion.matchup_score)}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    One-tap battle
                  </Badge>
                )}
                <Badge variant="outline" className="border-border/60 bg-background/50">
                  {dailySkirmishUsage.used}/{dailySkirmishUsage.limit} today
                </Badge>
                <Button
                  type="button"
                  onClick={handleStartSkirmish}
                  disabled={startingSkirmish || dailyLimitReached}
                  className={`gradient-button h-11 w-full px-5 text-sm sm:w-auto sm:text-base ${
                    !startingSkirmish && !dailyLimitReached && !prefersReducedMotion ? "pulse-glow-slow" : ""
                  }`}
                >
                  {startingSkirmish ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start Skirmish
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-card/60 p-4">
              {suggestion?.reason ? (
                <p className="mb-3 text-sm text-muted-foreground">{suggestion.reason}</p>
              ) : null}
              <Button
                type="button"
                onClick={handleStartSkirmish}
                disabled={startingSkirmish || dailyLimitReached}
                className={`gradient-button h-11 w-full px-5 text-sm sm:w-auto sm:text-base ${
                  !startingSkirmish && !dailyLimitReached && !prefersReducedMotion ? "pulse-glow-slow" : ""
                }`}
              >
                {startingSkirmish ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Skirmish
                  </>
                )}
              </Button>
            </div>
          )}
      {embedded ? (
        </div>
      ) : (
        <></><>{/* close CardContent+Card */}</><>
        </CardContent>
      </Card>
        </>
      )}

      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What is Spider Skirmish?</DialogTitle>
            <DialogDescription>
              Spider Skirmish is a quick scrimmage mode with progression rewards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              In a skirmish, you get a fast one-click battle using one of your spiders against an evenly matched rival.
            </p>
            <p>
              If your spider wins, you gain user XP and the winning spider gets a modest stat boost.
            </p>
            <p>
              This is different from a Spider Battle: in battles, spider ownership can transfer to the winning user.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Spider Skirmish Battle Action</DialogTitle>
          </DialogHeader>

          {result && replayState && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <img
                        src={result.player_spider.image_url}
                        alt={result.player_spider.nickname}
                        className="h-14 w-14 rounded-md object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{result.player_spider.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">{result.player_spider.species}</p>
                      </div>
                    </div>
                    <Progress value={(replayState.playerHp / result.player_spider.hit_points) * 100} className="h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      HP {replayState.playerHp}/{result.player_spider.hit_points}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <img
                        src={result.opponent_spider.image_url}
                        alt={result.opponent_spider.nickname}
                        className="h-14 w-14 rounded-md object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{result.opponent_spider.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {result.opponent_spider.species}
                          {result.opponent_spider.owner_display_name
                            ? ` · ${result.opponent_spider.owner_display_name}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <Progress value={(replayState.opponentHp / result.opponent_spider.hit_points) * 100} className="h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      HP {replayState.opponentHp}/{result.opponent_spider.hit_points}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Battle Progress</p>
                  <p className="text-xs text-muted-foreground">
                    {visibleTurnCount}/{result.turn_log.length} turns
                  </p>
                </div>
                <Progress value={skirmishProgress} className="h-2" />
                {replayState.latestTurn && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Turn {replayState.latestTurn.turn}:{" "}
                    {replayState.latestTurn.attacker_side === "A"
                      ? result.player_spider.nickname
                      : result.opponent_spider.nickname}{" "}
                    dealt {replayState.latestTurn.damage} damage
                    {replayState.latestTurn.crit ? " (CRIT!)" : ""}.
                  </p>
                )}
              </div>

              {replayState.isComplete && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      <p className="font-semibold">
                        Winner:{" "}
                        {result.winner_spider_id === result.player_spider.id
                          ? result.player_spider.nickname
                          : result.opponent_spider.nickname}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        XP reward: {result.winner_side === "A"
                          ? `+${result.rewards?.xp_gain ?? 0} XP awarded to you.`
                          : `${winnerTrainerName} earned the XP from this win.`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Spider attribute reward: {winnerSpiderName} receives the stat improvements for winning.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.winner_side === "A" ? (
                          <Badge>+{result.rewards?.xp_gain ?? 0} XP to you</Badge>
                        ) : (
                          <Badge variant="outline">XP to {winnerTrainerName}</Badge>
                        )}
                        {result.rewards?.new_level ? <Badge variant="outline">Your Level {result.rewards.new_level}</Badge> : null}
                        {rewardStatEntries.length > 0 ? rewardStatEntries.map(([stat, value]) => (
                          <Badge key={stat} variant="secondary">
                            {winnerSpiderName}: {formatStatLabel(stat)} +{value}
                          </Badge>
                        )) : (
                          <Badge variant="secondary">{winnerSpiderName}: +1 stat boost</Badge>
                        )}
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button type="button" onClick={() => closeModal(false)}>
                        Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
