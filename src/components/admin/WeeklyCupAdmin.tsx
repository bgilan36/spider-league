import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { weekLabel, type GameWeek } from "@/lib/tournament";

const db = supabase as any;

async function call(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("weekly-tournament", { body: { action, ...extra } });
  if (error) {
    let details = error.message;
    try { details = await (error as any).context?.text?.() ?? details; } catch { /* ignore */ }
    throw new Error(details);
  }
  return data;
}

interface WeekStats { week: GameWeek; wau: number; freshPct: number; championPct: number; emailVisits: number }

export default function WeeklyCupAdmin() {
  const { toast } = useToast();
  const [weeks, setWeeks] = useState<GameWeek[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [brackets, setBrackets] = useState<any[]>([]);
  const [raw, setRaw] = useState<{ id: string; json: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [stats, setStats] = useState<WeekStats[]>([]);

  const load = useCallback(async () => {
    const { data: w } = await db.from("game_weeks").select("*").order("starts_at", { ascending: false }).limit(12);
    setWeeks(w ?? []);
    setNames(Object.fromEntries((w ?? []).map((x: GameWeek) => [x.id, x.display_name ?? ""])));
    const { data: b } = await db.from("brackets").select("id, week_id, type, pod_id, size, champion_participant_id").order("created_at", { ascending: false }).limit(40);
    setBrackets(b ?? []);
    const { data: l } = await db.from("tournament_pipeline_log").select("*").order("created_at", { ascending: false }).limit(25);
    setLog(l ?? []);

    // Analytics per real week
    const real = (w ?? []).filter((x: GameWeek) => !x.is_test).slice(0, 8);
    if (real.length) {
      const from = real[real.length - 1].starts_at;
      const [{ data: ev }, { data: sp }] = await Promise.all([
        db.from("app_events").select("user_id, event, week_id, props, created_at").gte("created_at", from).limit(10000),
        db.from("spiders").select("owner_id, created_at").gte("created_at", from).limit(10000),
      ]);
      setStats(real.map((wk: GameWeek) => {
        const end = new Date(new Date(wk.starts_at).getTime() + 7 * 86400000).toISOString();
        const inWeek = (ev ?? []).filter((e: any) => e.created_at >= wk.starts_at && e.created_at < end);
        const active = new Set(inWeek.filter((e: any) => e.user_id).map((e: any) => e.user_id));
        const freshUsers = new Set((sp ?? []).filter((s: any) => s.created_at >= wk.starts_at && s.created_at < wk.locks_at).map((s: any) => s.owner_id));
        freshUsers.forEach((u) => active.add(u));
        const fresh = [...active].filter((u) => freshUsers.has(u)).length;
        const champs = new Set((ev ?? []).filter((e: any) => e.event === "results_viewed" && e.week_id === wk.id && e.props?.reached_champion && e.user_id).map((e: any) => e.user_id));
        return {
          week: wk, wau: active.size,
          freshPct: active.size ? Math.round((fresh / active.size) * 100) : 0,
          championPct: active.size ? Math.round(([...champs].filter((u) => active.has(u) || true).length / active.size) * 100) : 0,
          emailVisits: inWeek.filter((e: any) => e.event === "email_visit").length,
        };
      }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: string, extra?: Record<string, unknown>, ok?: (d: any) => string) => {
    setBusy(key);
    try {
      const d = await call(action, extra);
      if (d?.ok === false) throw new Error(d.error);
      toast({ title: "Done", description: ok ? ok(d) : undefined });
      if (action.startsWith("preview")) setPreview({ subject: d.subject, html: d.html });
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: String(e.message ?? e).slice(0, 300), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const inspect = async (id: string) => {
    const [{ data: b }, { data: m }] = await Promise.all([
      db.from("brackets").select("*").eq("id", id).single(),
      db.from("matches").select("*").eq("bracket_id", id).order("round_number").order("slot"),
    ]);
    setRaw({ id, json: JSON.stringify({ bracket: b, matches: m }, null, 2) });
  };

  const B = ({ k, children, ...p }: any) => (
    <Button disabled={!!busy} {...p}>{busy === k && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{children}</Button>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test week</CardTitle>
          <CardDescription>Runs the full pipeline (lock → brackets → simulate → publish) on current data in a separate test week. The real week isn't touched, and no trophies or season points are awarded.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <B k="run" onClick={() => run("run", "run_test", {}, (d) => `Test week ${d.week?.id} published`)}>Run test week</B>
          <B k="reset" variant="outline" onClick={() => run("reset", "reset_test")}>Reset test week</B>
          {weeks.find((w) => w.is_test) && <Button variant="outline" asChild><Link to={`/week/${weeks.find((w) => w.is_test)!.id}`}>Watch test results</Link></Button>}
          <B k="tick" variant="ghost" onClick={() => run("tick", "run_now")}>Run hourly job now</B>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emails</CardTitle>
          <CardDescription>Sends to your own address using your real data. Results uses the latest published week (including a test week).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <B k="sr" onClick={() => run("sr", "send_test_results", {}, (d) => `Sent "${d.subject}" to ${d.to}`)}>Send me this week's results email</B>
            <B k="sn" onClick={() => run("sn", "send_test_nudge", {}, (d) => `Sent to ${d.to}`)}>Send me the Friday nudge</B>
            <B k="pr" variant="outline" onClick={() => run("pr", "preview_test_results")}>Preview results</B>
            <B k="pn" variant="outline" onClick={() => run("pn", "preview_test_nudge")}>Preview nudge</B>
          </div>
          {preview && (
            <div className="space-y-1">
              <div className="text-sm">Subject: <b>{preview.subject}</b></div>
              <iframe title="Email preview" srcDoc={preview.html} className="h-[600px] w-full max-w-[420px] rounded border border-border bg-background" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Weekly engagement</CardTitle><CardDescription>Active = uploaded or used the app that week.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Week</th><th className="pr-3">Weekly active</th><th className="pr-3">% with fresh catch</th><th className="pr-3">% watched to champion</th><th>Email visits</th></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.week.id} className="border-t border-border"><td className="py-1.5 pr-3">{weekLabel(s.week)}</td><td className="pr-3">{s.wau}</td><td className="pr-3">{s.freshPct}%</td><td className="pr-3">{s.championPct}%</td><td>{s.emailVisits}</td></tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Weeks</CardTitle><CardDescription>Set a display name like "Halloween Cup". Players see it instead of "Week of …".</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {weeks.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
              <span className="w-28 text-xs font-mono">{w.id}</span>
              <Badge variant={w.status === "published" ? "default" : "outline"}>{w.status}</Badge>
              {w.is_test && <Badge variant="secondary">test</Badge>}
              <Input className="h-8 flex-1 min-w-[160px]" placeholder={weekLabel({ ...w, display_name: null })} value={names[w.id] ?? ""} onChange={(e) => setNames((n) => ({ ...n, [w.id]: e.target.value }))} />
              <B k={`n${w.id}`} size="sm" variant="outline" onClick={() => run(`n${w.id}`, "set_display_name", { week_id: w.id, display_name: names[w.id] ?? "" })}>Save</B>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Brackets</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {brackets.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs w-32">{b.week_id}</span>
              <span className="flex-1">{b.type === "global" ? "Global Cup" : `Pod ${b.pod_id?.slice(0, 8)}`} · {b.size}</span>
              <Button size="sm" variant="ghost" onClick={() => inspect(b.id)}>Raw results</Button>
            </div>
          ))}
          {raw && <pre className="max-h-[480px] overflow-auto rounded bg-muted p-3 text-[11px]">{raw.json}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pipeline log</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs font-mono">
          {log.map((l) => (
            <div key={l.id} className="flex gap-2"><span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span><span>{l.week_id}</span><span>{l.step}</span><span className={l.status === "error" ? "text-destructive" : ""}>{l.status}</span><span className="truncate text-muted-foreground">{l.detail ? JSON.stringify(l.detail) : ""}</span></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
