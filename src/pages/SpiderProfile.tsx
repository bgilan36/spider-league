import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, MapPin, Shield, Sparkles, Swords, Trophy } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";
import SpiderPhoto from "@/components/visual/SpiderPhoto";
import RarityBadge from "@/components/visual/RarityBadge";
import StatBar, { type StatKey } from "@/components/visual/StatBar";
import PowerLabel from "@/components/visual/PowerLabel";
import { roundLabels, weekLabel } from "@/lib/tournament";

const db = supabase as any;

const STAT_FIELDS: Array<{ stat: StatKey; field: string }> = [
  { stat: "hp", field: "hit_points" },
  { stat: "damage", field: "damage" },
  { stat: "speed", field: "speed" },
  { stat: "defense", field: "defense" },
  { stat: "venom", field: "venom" },
  { stat: "webcraft", field: "webcraft" },
];

export default function SpiderProfile() {
  const { spiderId = "" } = useParams();
  const navigate = useNavigate();
  const [spider, setSpider] = useState<any | null>(null);
  const [trophies, setTrophies] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [battles, setBattles] = useState<any[]>([]);
  const [skirmishes, setSkirmishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!spiderId) return;
    (async () => {
      setLoading(true);
      const [spiderRes, trophyRes, matchRes, battleRes, skirmishRes] = await Promise.all([
        db.from("spiders").select("*, owner:profiles!spiders_owner_id_fkey(id, display_name, avatar_url)").eq("id", spiderId).maybeSingle(),
        db.from("trophies").select("id, kind, week_id, pod_id, created_at, game_weeks(starts_at, display_name)").eq("spider_id", spiderId).order("created_at", { ascending: false }),
        db.from("matches")
          .select("id, round_number, winner_id, spider_a_id, spider_b_id, is_upset, brackets!inner(id, type, size, champion_participant_id, week_id, pod_id, game_weeks!inner(starts_at, display_name, status, is_test), private_leagues(name))")
          .or(`spider_a_id.eq.${spiderId},spider_b_id.eq.${spiderId}`)
          .eq("brackets.game_weeks.status", "published")
          .eq("brackets.game_weeks.is_test", false),
        db.from("battles")
          .select("id, created_at, type, mode, winner, team_a, team_b")
          .or(`team_a->spider->>id.eq.${spiderId},team_b->spider->>id.eq.${spiderId}`)
          .not("winner", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),
        db.from("spider_skirmishes")
          .select("id, created_at, player_spider_id, opponent_spider_id, winner_spider_id, player_spider_snapshot, opponent_spider_snapshot")
          .or(`player_spider_id.eq.${spiderId},opponent_spider_id.eq.${spiderId}`)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setSpider(spiderRes.data ?? null);
      setActivePhoto(spiderRes.data?.image_url ?? null);
      setTrophies(trophyRes.data ?? []);
      setBattles(battleRes.data ?? []);
      setSkirmishes(skirmishRes.data ?? []);

      const byBracket = new Map<string, any>();
      for (const m of matchRes.data ?? []) {
        const b = m.brackets;
        const cur = byBracket.get(b.id) ?? { b, maxRound: 0, wins: 0, losses: 0 };
        cur.maxRound = Math.max(cur.maxRound, m.round_number);
        if (m.winner_id) {
          if (m.winner_id === spiderId) cur.wins += 1;
          else cur.losses += 1;
        }
        byBracket.set(b.id, cur);
      }
      const tourneyRows = [...byBracket.values()].map(({ b, maxRound, wins, losses }) => {
        const labels = roundLabels(b.size);
        const isChamp = b.champion_participant_id === spiderId;
        return {
          id: b.id,
          weekId: b.week_id,
          podId: b.pod_id,
          type: b.type,
          label: weekLabel(b.game_weeks),
          where: b.type === "global" ? "Global Cup" : b.private_leagues?.name ?? "Pod",
          result: isChamp ? "Champion" : `Out in ${labels[maxRound - 1] ?? `Round ${maxRound}`}`,
          isChamp,
          wins,
          losses,
          to: b.type === "pod" && b.pod_id ? `/pods/${b.pod_id}/week/${b.week_id}` : `/cup/${b.week_id}`,
        };
      }).sort((a, b) => b.weekId.localeCompare(a.weekId));
      setTournaments(tourneyRows);
      setLoading(false);
    })();
  }, [spiderId]);

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><SpiderLogoLoader /></div>;

  if (!spider) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12 text-center space-y-3">
        <h1 className="text-2xl font-bold">Spider not found</h1>
        <p className="text-muted-foreground">This spider may have been removed or isn&apos;t available.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const photos = [
    { url: spider.image_url, label: "Spider photo" },
    ...(spider.share_image_url ? [{ url: spider.share_image_url, label: "Fighter card" }] : []),
  ].filter((p) => Boolean(p.url));

  const specials: Array<{ name: string; description?: string; damage?: number }> = Array.isArray(spider.special_attacks)
    ? spider.special_attacks
    : [];

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
    + battles.filter((b) => (b.team_a?.spider?.id === spiderId ? b.winner === "A" : b.winner === "B")).length
    + skirmishes.filter((sk) => sk.winner_spider_id === spiderId).length;
  const totalMatches = tournaments.reduce((s, t) => s + t.wins + t.losses, 0) + battles.length + skirmishes.length;

  return (
    <div className="container mx-auto max-w-3xl px-3 py-4 sm:py-6 space-y-6">
      <Helmet>
        <title>{`${spider.nickname} (${spider.species}) — Spider League`}</title>
      </Helmet>

      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {/* Header & Photos */}
      <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2 sm:w-56 shrink-0">
            <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted">
              <SpiderPhoto src={activePhoto || spider.image_url} alt={spider.nickname} rarity={spider.rarity} className="h-full w-full object-cover" />
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2">
                {photos.map((ph) => (
                  <button
                    key={ph.url}
                    type="button"
                    onClick={() => setActivePhoto(ph.url)}
                    className={`h-14 w-14 overflow-hidden rounded-lg border-2 transition ${activePhoto === ph.url ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                    aria-label={ph.label}
                  >
                    <img src={ph.url} alt={ph.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <RarityBadge rarity={spider.rarity} />
              <Badge variant="outline">Lv. {spider.level ?? 1}</Badge>
              {trophies.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Trophy className="h-3 w-3 text-primary" />{trophies.length} {trophies.length === 1 ? "trophy" : "trophies"}
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words">{spider.nickname}</h1>
              <p className="text-sm text-muted-foreground">{spider.species}</p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {spider.owner && (
                <Link to={`/collection/${spider.owner.id}`} className="hover:underline font-medium text-foreground">
                  Trainer: {spider.owner.display_name || "Unknown"}
                </Link>
              )}
              {spider.created_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />Caught {format(new Date(spider.created_at), "MMM d, yyyy")}
                </span>
              )}
              {spider.location_name && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{spider.location_name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-lg border bg-background p-2.5 text-center">
                <div className="text-xs text-muted-foreground">Power</div>
                <div className="text-lg font-black"><PowerLabel value={spider.power_score} iconOnly /></div>
              </div>
              <div className="rounded-lg border bg-background p-2.5 text-center">
                <div className="text-xs text-muted-foreground">Record</div>
                <div className="text-lg font-black">{totalWins}–{Math.max(0, totalMatches - totalWins)}</div>
              </div>
              <div className="rounded-lg border bg-background p-2.5 text-center">
                <div className="text-xs text-muted-foreground">XP</div>
                <div className="text-lg font-black">{spider.xp ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Combat Stats & Special Attacks */}
      <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Combat stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAT_FIELDS.map(({ stat, field }) => (
            <StatBar key={stat} stat={stat} value={spider[field] ?? 0} />
          ))}
        </div>
        {specials.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />Special attacks
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {specials.map((sp, idx) => (
                <div key={`${sp.name}-${idx}`} className="rounded-lg border bg-background p-3">
                  <div className="font-semibold text-sm">{sp.name}{sp.damage ? <span className="text-xs text-muted-foreground ml-1.5">({sp.damage} dmg)</span> : null}</div>
                  {sp.description && <p className="text-xs text-muted-foreground mt-0.5">{sp.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Tournament History */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Tournament history</h2>
        {tournaments.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No published tournaments yet.</p>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {tournaments.map((t) => (
              <Link key={t.id} to={t.to} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 transition">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.label} · {t.where}</div>
                  <div className="text-xs text-muted-foreground">{t.wins}–{t.losses} in bracket</div>
                </div>
                <span className={`shrink-0 text-xs font-bold ${t.isChamp ? "text-primary" : "text-muted-foreground"}`}>{t.result}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Battle & Skirmish History */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><Swords className="h-4 w-4 text-primary" />Battle &amp; skirmish history</h2>
        {battles.length === 0 && skirmishes.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No battles or skirmishes recorded yet.</p>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {battles.map((b) => {
              const isA = b.team_a?.spider?.id === spiderId;
              const opp = isA ? b.team_b?.spider : b.team_a?.spider;
              const won = (isA && b.winner === "A") || (!isA && b.winner === "B");
              const tied = b.winner === "TIE";
              return (
                <Link key={`b-${b.id}`} to={`/battle/${b.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 transition">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">vs {opp?.nickname || "Opponent"}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.mode || b.type} · {b.created_at ? format(new Date(b.created_at), "MMM d, yyyy") : ""}
                    </div>
                  </div>
                  <Badge variant={won ? "default" : tied ? "secondary" : "outline"}>{won ? "Win" : tied ? "Tie" : "Loss"}</Badge>
                </Link>
              );
            })}
            {skirmishes.map((sk) => {
              const isPlayer = sk.player_spider_id === spiderId;
              const opp = isPlayer ? sk.opponent_spider_snapshot : sk.player_spider_snapshot;
              const won = sk.winner_spider_id === spiderId;
              return (
                <div key={`s-${sk.id}`} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">vs {opp?.nickname || "Wild opponent"}</div>
                    <div className="text-xs text-muted-foreground">
                      Skirmish · {sk.created_at ? format(new Date(sk.created_at), "MMM d, yyyy") : ""}
                    </div>
                  </div>
                  <Badge variant={won ? "default" : "outline"}>{won ? "Win" : "Loss"}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}