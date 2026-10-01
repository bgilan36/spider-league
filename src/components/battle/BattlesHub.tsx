import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Swords, Hourglass, Search, Zap, Skull, Users, Loader2 } from "lucide-react";
import { usePlayerActions, spiderState } from "@/hooks/usePlayerActions";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import { MODES, RULES } from "@/lib/gameRules";
import { openChallengeComposer, openChallengeResponse, timeLeftLabel } from "@/lib/challenges";
import { useChallenges, STATE_LABEL, type ChallengeState } from "@/hooks/useChallenges";
import { Handshake } from "lucide-react";

const STATE_TONE: Record<ChallengeState, string> = {
  incoming: "border-primary text-primary", your_turn: "border-primary text-primary",
  pending: "", waiting: "", expired: "text-muted-foreground", declined: "text-muted-foreground",
  cancelled: "text-muted-foreground", completed: "",
};

function Section({ id, icon: Icon, title, count, children }: any) {
  return (
    <section id={id} className="mb-6 scroll-mt-20">
      <h2 className="flex items-center gap-2 text-lg font-bold mb-2">
        <Icon className="h-5 w-5 text-primary" />{title}
        {count > 0 && <Badge variant="secondary">{count}</Badge>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{text}</p>{cta}
    </CardContent></Card>
  );
}

/** Action needed / In progress / Find a battle — sits above the preserved Results history. */
export default function BattlesHub() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { loading, spiders, battles, incoming, inBattleIds } = usePlayerActions();
  const { open, picker } = useStartSkillBattle();
  const { rows: challenges } = useChallenges();

  useEffect(() => {
    if (!hash || loading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash, loading]);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6"><Loader2 className="h-4 w-4 animate-spin" />Loading your battles…</div>;

  const mine = battles.filter((b) => b.myTurn);
  const waiting = battles.filter((b) => !b.myTurn);
  const ready = spiders.filter((s) => spiderState(s, inBattleIds) === "ready");

  return (
    <div>
      <Section id="action-needed" icon={Bell} title="Action needed" count={mine.length + incoming.length}>
        {mine.length + incoming.length === 0 ? (
          <Empty text="Nothing waiting on you right now."
            cta={ready.length
              ? <Button onClick={() => open({ spiderId: ready[0].id })}>Start a {MODES.training.long}</Button>
              : <Button asChild variant="outline"><Link to="/skirmish">Wild Skirmish</Link></Button>} />
        ) : (
          <div className="space-y-2">
            {mine.map((b) => (
              <Card key={b.id} className="border-primary/40"><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold truncate">{b.mySpider} vs {b.oppSpider}</p>
                  <p className="text-xs text-muted-foreground">{b.training ? "Training · your move" : "Your turn — they're not necessarily online; take your time within the deadline"}</p></div>
                <Button size="sm" onClick={() => navigate(`/battle/${b.id}`)}>Resume</Button>
              </CardContent></Card>
            ))}
            {incoming.map((c) => (
              <Card key={c.id} className="border-destructive/40"><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold truncate">{c.challengerSpider} challenged {c.mySpider}</p>
                  <p className="text-xs text-muted-foreground">{c.capture ? `${MODES.capture.name} · winner takes the losing spider` : MODES.friendly.name}</p></div>
                <Button size="sm" variant="outline" onClick={() => openChallengeResponse(c.id)}>Review</Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </Section>

      <Section id="in-progress" icon={Hourglass} title="In progress" count={waiting.length}>
        {waiting.length === 0 ? (
          <Empty text="No battles waiting on an opponent."
            cta={<Button variant="outline" onClick={() => openChallengeComposer({ mySpiderId: ready[0]?.id })}><Handshake className="h-4 w-4 mr-1" />Send a {MODES.friendly.name}</Button>} />
        ) : (
          <div className="space-y-2">{waiting.map((b) => (
            <Card key={b.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold truncate">{b.mySpider} vs {b.oppSpider}</p>
                <p className="text-xs text-muted-foreground">Waiting on your opponent's move — they'll be notified. If they miss the {RULES.challenge.moveHours}h deadline, the computer plays for them.</p></div>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/battle/${b.id}`)}>View</Button>
            </CardContent></Card>
          ))}</div>
        )}
      </Section>

      <Section id="challenges" icon={Handshake} title="Challenges" count={challenges.filter((c) => c.state === "incoming").length}>
        {challenges.length === 0 ? (
          <Empty text={`No challenges yet. A ${MODES.friendly.name} never risks your spider.`}
            cta={<Button onClick={() => openChallengeComposer({ mySpiderId: ready[0]?.id })}>Challenge a player</Button>} />
        ) : (
          <div className="space-y-2">{challenges.slice(0, 12).map((c) => (
            <Card key={c.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate text-sm">{c.mySpider} vs {c.theirSpider ?? "open challenge"}</p>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className={`text-[10px] ${STATE_TONE[c.state]}`}>{STATE_LABEL[c.state]}</Badge>
                  <span>{c.capture ? MODES.capture.name : MODES.friendly.name}</span>
                  {(c.state === "pending" || c.state === "incoming") && <span>· expires in {timeLeftLabel(c.expires_at)}</span>}
                  {(c.state === "your_turn" || c.state === "waiting") && c.turn_deadline && <span>· move due in {timeLeftLabel(c.turn_deadline)}</span>}
                  {c.state === "completed" && c.won !== undefined && <span>· {c.won ? "You won" : "You lost"}</span>}
                </p>
              </div>
              {c.battle_id && c.state !== "pending" && c.state !== "incoming" ? (
                <Button size="sm" variant={c.state === "your_turn" ? "default" : "ghost"} onClick={() => navigate(`/battle/${c.battle_id}`)}>
                  {c.state === "your_turn" ? "Play" : "View"}
                </Button>
              ) : (c.state === "incoming" || c.state === "pending") ? (
                <Button size="sm" variant={c.state === "incoming" ? "default" : "ghost"} onClick={() => openChallengeResponse(c.id)}>
                  {c.state === "incoming" ? "Review" : "Manage"}
                </Button>
              ) : c.state !== "completed" ? (
                <Button size="sm" variant="ghost" onClick={() => openChallengeComposer({ mySpiderId: ready[0]?.id })}>New</Button>
              ) : null}
            </CardContent></Card>
          ))}</div>
        )}
      </Section>

      <Section id="find" icon={Search} title="Find a battle" count={0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Card className="border-primary/40"><CardContent className="p-3">
            <p className="font-semibold flex items-center gap-1"><Handshake className="h-4 w-4" />{MODES.friendly.name}</p>
            <p className="text-xs text-muted-foreground mb-2">Take turns with a real player. No spider is lost.</p>
            <Button size="sm" className="w-full" onClick={() => openChallengeComposer({ mySpiderId: ready[0]?.id })}>Challenge a player</Button>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="font-semibold flex items-center gap-1"><Zap className="h-4 w-4" />{MODES.training.long}</p>
            <p className="text-xs text-muted-foreground mb-2">{ready.length ? `${ready.length} spider${ready.length > 1 ? "s" : ""} ready.` : spiders.length ? `All spiders resting or retired (${RULES.battleCooldownHours}h cooldown).` : "You need a spider first."}</p>
            {ready.length ? <Button size="sm" variant="outline" className="w-full" onClick={() => open({ spiderId: ready[0].id })}>Battle now</Button>
              : <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(spiders.length ? "/#starting-5" : "/upload")}>{spiders.length ? "View Starting 5" : "Upload a spider"}</Button>}
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="font-semibold flex items-center gap-1"><Swords className="h-4 w-4" />Wild Skirmish</p>
            <p className="text-xs text-muted-foreground mb-2">{RULES.skirmish.dailyLimit} per day, no cooldown.</p>
            <Button size="sm" variant="outline" className="w-full" asChild><Link to="/skirmish">Skirmish</Link></Button>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="font-semibold flex items-center gap-1"><Skull className="h-4 w-4" />{MODES.capture.name}</p>
            <p className="text-xs text-muted-foreground mb-2">Open challenges — winner takes the spider.</p>
            <Button size="sm" variant="outline" className="w-full" asChild><Link to="/#capture-challenges">Browse challenges</Link></Button>
          </CardContent></Card>
        </div>
      </Section>
      {picker}
    </div>
  );
}
