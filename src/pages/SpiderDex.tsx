import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { useSpeciesProgress } from "@/lib/spiderDex/useSpeciesProgress";
import SpeciesCard from "@/components/dex/SpeciesCard";
import SpeciesDetailModal from "@/components/dex/SpeciesDetailModal";
import type { DexEntry } from "@/lib/spiderDex/useSpeciesProgress";

type Filter = "all" | "caught" | "uncaught" | "retired";

export default function SpiderDex() {
  const { user } = useAuth();
  const progress = useSpeciesProgress(user?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<DexEntry | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return progress.entries.filter((e) => {
      if (filter === "caught"   && !e.caught) return false;
      if (filter === "uncaught" &&  e.caught) return false;
      if (filter === "retired"  && !e.retired) return false;
      if (q) {
        const hay = `${e.commonName} ${e.species?.scientificName ?? ""} ${e.species?.family ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [progress.entries, filter, query]);

  const visibleWild = useMemo(() => {
    if (filter === "uncaught") return [];
    const q = query.trim().toLowerCase();
    return progress.wildEntries.filter((e) => {
      if (filter === "retired" && !e.retired) return false;
      if (q && !e.commonName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [progress.wildEntries, filter, query]);

  const pct = progress.totalCanon > 0
    ? Math.round((progress.caughtCount / progress.totalCanon) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>SpiderDex — Spider League</title>
        <meta name="description" content="Your collection of every spider species you've ever caught in Spider League." />
        <link rel="canonical" href={`${window.location.origin}/dex`} />
      </Helmet>

      <div className="max-w-6xl mx-auto p-4 space-y-5">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Home</Link>
        </Button>

        {/* Header card */}
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white border-zinc-800">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-yellow-300 text-xs font-bold tracking-[0.2em] uppercase">
                <BookOpen className="h-3.5 w-3.5" />
                SpiderDex
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold">
                {progress.caughtCount}/{progress.totalCanon} common North American species
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Every species you've ever caught is memorialized here — active and retired.
              </p>
            </div>
            <div className="flex gap-4 text-center text-white/90">
              <Mini label="Distinct" value={progress.distinctEver} />
              <Mini label="Catches"  value={progress.totalCatches} />
              <Mini label="Memorial" value={progress.retiredMemorials} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-xs tabular-nums text-white/80 w-10 text-right">{pct}%</span>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "caught", "uncaught", "retired"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search species…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Grid */}
        {progress.loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="aspect-square animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : visible.length === 0 && visibleWild.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No species match this filter.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visible.map((e) => (
                <SpeciesCard key={e.slug} entry={e} onOpen={() => setActive(e)} />
              ))}
            </div>

            {visibleWild.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground mt-6">
                  Wild Catches <span className="font-normal">({visibleWild.length} not in the common list)</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {visibleWild.map((e) => (
                    <SpeciesCard key={e.slug} entry={e} onOpen={() => setActive(e)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <SpeciesDetailModal entry={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[60px]">
      <div className="text-xl sm:text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}