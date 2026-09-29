import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSpeciesLibrary, type SpeciesReference } from "@/lib/spiderDex/useSpeciesReference";

type DangerFilter = "all" | "harmless" | "caution" | "medical";

function dangerTier(danger: string): DangerFilter {
  const d = danger.toLowerCase();
  if (d.includes("medical") || d.includes("dangerous") || d.includes("significant")) return "medical";
  if (d.includes("mild") || d.includes("minor") || d.includes("low") || d.includes("caution")) return "caution";
  return "harmless";
}

export default function SpeciesGuide() {
  const { data: library, isLoading } = useSpeciesLibrary();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string>("all");
  const [danger, setDanger] = useState<DangerFilter>("all");

  const families = useMemo(() => {
    const set = new Set((library ?? []).map((s) => s.family));
    return Array.from(set).sort();
  }, [library]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library ?? []).filter((s) => {
      if (family !== "all" && s.family !== family) return false;
      if (danger !== "all" && dangerTier(s.danger) !== danger) return false;
      if (q) {
        const hay = `${s.common_name} ${s.scientific_name} ${s.family} ${s.habitat} ${s.us_range}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [library, query, family, danger]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>Spider Species Guide — Spider League</title>
        <meta
          name="description"
          content="Real facts, photos, habitats and ranges for every spider species in Spider League — compare the AI's guess against the real thing."
        />
        <link rel="canonical" href={`${window.location.origin}/species`} />
      </Helmet>

      <div className="max-w-6xl mx-auto p-4 space-y-5">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Home</Link>
        </Button>

        <Card className="p-5 sm:p-6 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white border-zinc-800">
          <div className="flex items-center gap-2 text-yellow-300 text-xs font-bold tracking-[0.2em] uppercase">
            <BookOpen className="h-3.5 w-3.5" />
            Field Guide
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold">
            {library?.length ?? "…"} real North American species
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Photos, habitats, ranges and key features for every species the AI can identify — check its guess against the real facts.
          </p>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, habitat, range…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Filter by family"
          >
            <option value="all">All families</option>
            {families.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {(["all", "harmless", "caution", "medical"] as DangerFilter[]).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={danger === d ? "default" : "outline"}
              onClick={() => setDanger(d)}
              className="capitalize"
            >
              {d === "medical" ? "Medically significant" : d}
            </Button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No species match this filter.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((s) => (
              <SpeciesCard key={s.slug} species={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SpeciesCard({ species: s }: { species: SpeciesReference }) {
  const tier = dangerTier(s.danger);
  return (
    <Card className="overflow-hidden flex flex-col">
      {s.image_url ? (
        <img
          src={s.image_url}
          alt={`Real photo of ${s.common_name}`}
          loading="lazy"
          className="w-full h-44 object-cover"
        />
      ) : (
        <div className="w-full h-44 bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
          No photo available
        </div>
      )}
      <div className="p-3 space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold leading-tight">{s.common_name}</div>
            <div className="text-xs italic text-muted-foreground truncate">
              {s.scientific_name} · <span className="not-italic">{s.family}</span>
            </div>
          </div>
          {tier === "medical" && (
            <Badge variant="destructive" className="shrink-0 gap-1 text-[10px]">
              <ShieldAlert className="h-3 w-3" /> Caution
            </Badge>
          )}
        </div>
        <div className="text-xs"><span className="font-medium">Habitat:</span> <span className="text-muted-foreground">{s.habitat}</span></div>
        <div className="text-xs"><span className="font-medium">Range:</span> <span className="text-muted-foreground">{s.us_range}</span></div>
        <div className="text-xs"><span className="font-medium">Size:</span> <span className="text-muted-foreground">{s.size_min_mm}–{s.size_max_mm} mm body length</span></div>
        <div className="text-xs"><span className="font-medium">Looks like:</span> <span className="text-muted-foreground">{s.diagnostic_features}</span></div>
        {s.summary && <p className="text-[11px] text-muted-foreground line-clamp-3">{s.summary}</p>}
        <div className="mt-auto pt-1 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
          {s.image_credit && <span className="truncate">Photo: {s.image_credit}</span>}
          {s.wikipedia_url && (
            <a href={s.wikipedia_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
              Wikipedia <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
