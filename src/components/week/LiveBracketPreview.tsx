import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GitBranch, RefreshCw, Trophy, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { roundLabels, TOURNAMENT, type Participant } from "@/lib/tournament";
import { cn } from "@/lib/utils";

interface Preview {
  week: { id: string; locks_at: string; status: string } | null;
  participants: Participant[];
  slots: (Participant | null)[];
  size: number;
  closed?: boolean;
}

function Fighter({ spider, mine }: { spider: Participant | null; mine?: string }) {
  if (!spider) return <div className="h-16 flex items-center px-3 text-xs text-muted-foreground">Bye · automatic advance</div>;
  return (
    <Link to={spider.owner_id ? `/collection/${spider.owner_id}` : "/collection"} className={cn("flex h-16 min-w-0 items-center gap-2 px-3 transition-colors hover:bg-accent", spider.owner_id === mine && "bg-primary/10")}>
      <span className="w-5 shrink-0 text-xs font-bold text-primary">{spider.seed}</span>
      {spider.image_url && <img src={spider.image_url} alt={spider.name} loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{spider.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{spider.owner_id === mine ? "Your spider" : spider.owner_name} · {spider.power} Power</div>
      </div>
    </Link>
  );
}

export default function LiveBracketPreview({ weekId, myUserId, revision = "" }: { weekId?: string; myUserId?: string; revision?: string }) {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["live-global-bracket", weekId, revision],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("weekly-tournament", { body: { action: "preview_bracket", ...(weekId ? { week_id: weekId } : {}) } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Couldn't load bracket");
      return data as Preview;
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const labels = roundLabels(data?.size ?? 0);

  return (
    <section className="min-w-0 space-y-3 border-t border-border pt-4" aria-label="Live Global Cup bracket">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black"><GitBranch className="h-5 w-5 text-primary" />Live bracket preview</h2>
        <Button variant="ghost" size="icon" aria-label="Refresh bracket" title="Refresh bracket" disabled={isFetching} onClick={() => refetch()}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>
      {isPending ? <p role="status" className="text-sm text-muted-foreground">Loading the field…</p> : error ? (
        <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Couldn't load this week's bracket.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
      ) : data?.closed ? (
        <div className="space-y-2"><p className="text-sm text-muted-foreground">The field has locked. Sunday's competition is underway.</p><Button asChild variant="outline"><Link to={`/week/${data.week?.id}`}>View this week's tournament</Link></Button></div>
      ) : !data?.week ? <p className="text-sm text-muted-foreground">Next week's field opens shortly.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-primary">{data.participants.length} real contender{data.participants.length === 1 ? "" : "s"}</span>
            {data.size > 0 && <span className="text-muted-foreground">· {data.size}-slot bracket · {data.size - data.participants.length} bye{data.size - data.participants.length === 1 ? "" : "s"}</span>}
            <span className="border border-border rounded px-2 py-1 text-muted-foreground">Provisional seeds</span>
          </div>
          <p className="text-xs text-muted-foreground">The field grows with this week's entries. Matchups and byes can change until {TOURNAMENT.LOCK_LABEL}.</p>
          {data.size === 0 ? (
            <div className="space-y-3 py-3">
              <p className="text-sm font-semibold">{data.participants.length === 1 ? "One contender is waiting for a rival." : "The field is open. Who will be first?"}</p>
              <p className="text-xs text-muted-foreground">At least two real entered spiders are needed for a Global Cup. No generated opponents.</p>
              {data.participants.map((s) => <Fighter key={s.id} spider={{ ...s, seed: 1 }} mine={myUserId} />)}
              <Button asChild variant="outline"><Link to="/upload"><Camera className="mr-2 h-4 w-4" />Catch a contender</Link></Button>
            </div>
          ) : (
            <div className="max-h-[520px] w-full overflow-auto pb-3" tabIndex={0} aria-label="Provisional tournament rounds">
              <div className="flex min-w-max gap-5">
                {labels.map((label, r) => (
                  <div key={label} className="flex w-64 shrink-0 flex-col">
                    <h3 className="sticky top-0 z-10 bg-background py-2 text-xs font-bold uppercase text-primary">{label}</h3>
                    <div className="flex flex-1 flex-col justify-around gap-4">
                      {Array.from({ length: data.size / 2 ** (r + 1) }, (_, slot) => (
                        <div key={slot} className="relative rounded-md border border-border bg-card divide-y divide-border after:absolute after:-right-5 after:top-1/2 after:w-5 after:border-t after:border-border">
                          {r === 0 ? <><Fighter spider={data.slots[slot * 2]} mine={myUserId} /><Fighter spider={data.slots[slot * 2 + 1]} mine={myUserId} /></> : (
                            <><div className="flex h-16 items-center px-3 text-xs text-muted-foreground">Winner of match {slot * 2 + 1}</div><div className="flex h-16 items-center px-3 text-xs text-muted-foreground">Winner of match {slot * 2 + 2}</div></>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex w-40 shrink-0 flex-col"><h3 className="py-2 text-xs font-bold uppercase text-primary">Champion</h3><div className="flex flex-1 flex-col justify-center items-center gap-2"><Trophy className="h-10 w-10 text-primary" /><span className="text-sm font-bold">Crowned Sunday</span></div></div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}