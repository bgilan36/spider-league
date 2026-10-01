import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Swords, Hourglass, Search, Zap, Skull, Users, Loader2 } from "lucide-react";
import { usePlayerActions, spiderState } from "@/hooks/usePlayerActions";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import { MODES, RULES } from "@/lib/gameRules";

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
                  <p className="text-xs text-muted-foreground">{b.training ? "Training · your move" : "Your turn"}</p></div>
                <Button size="sm" onClick={() => navigate(`/battle/${b.id}`)}>Resume</Button>
              </CardContent></Card>
            ))}
            {incoming.map((c) => (
              <Card key={c.id} className="border-destructive/40"><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold truncate">{c.challengerSpider} challenged {c.mySpider}</p>
                  <p className="text-xs text-muted-foreground">{c.capture ? `${MODES.capture.name} · winner takes the losing spider` : MODES.friendly.name}</p></div>
                <Button size="sm" variant="outline" onClick={() => navigate("/#capture-challenges")}>Respond</Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </Section>

      <Section id="in-progress" icon={Hourglass} title="In progress" count={waiting.length}>
        {waiting.length === 0 ? (
          <Empty text="No battles waiting on an opponent. Challenge a friend in your pod."
            cta={<Button asChild variant="outline"><Link to="/pods"><Users className="h-4 w-4 mr-1" />Open Pods</Link></Button>} />
        ) : (
          <div className="space-y-2">{waiting.map((b) => (
            <Card key={b.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold truncate">{b.mySpider} vs {b.oppSpider}</p>
                <p className="text-xs text-muted-foreground">Waiting on your opponent</p></div>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/battle/${b.id}`)}>View</Button>
            </CardContent></Card>
          ))}</div>
        )}
      </Section>

      <Section id="find" icon={Search} title="Find a battle" count={0}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Card><CardContent className="p-3">
            <p className="font-semibold flex items-center gap-1"><Zap className="h-4 w-4" />{MODES.training.long}</p>
            <p className="text-xs text-muted-foreground mb-2">{ready.length ? `${ready.length} spider${ready.length > 1 ? "s" : ""} ready.` : spiders.length ? `All spiders resting or retired (${RULES.battleCooldownHours}h cooldown).` : "You need a spider first."}</p>
            {ready.length ? <Button size="sm" className="w-full" onClick={() => open({ spiderId: ready[0].id })}>Battle now</Button>
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
