import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

type Range = "week" | "month" | "all";

const RANGE_LABELS: Record<Range, string> = {
  week: "Past week",
  month: "Past month",
  all: "All time",
};

export default function SpiderUploadHeatmap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<any>(null);
  const [range, setRange] = useState<Range>("all");
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [globalCount, setGlobalCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_heatmap_stats");
      if (!cancelled) setGlobalCount(Number((data?.[0] as any)?.mapped_count ?? 0));
    })();
    return () => { cancelled = true; };
  }, []);

  // Init map once
  useEffect(() => {
    if (globalCount === null || globalCount < 10) return;
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      worldCopyJump: true,
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([20, 0], 2);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }
    ).addTo(map);

    // Cluster click → top spider in area
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const zoom = map.getZoom();
      const radius = zoom >= 10 ? 0.15 : zoom >= 6 ? 0.6 : 2.5;
      const { data, error } = await supabase.rpc("get_top_spider_in_area", {
        p_lat: lat, p_lng: lng, p_radius_deg: radius,
      });
      if (error || !data || (data as any[]).length === 0) return;
      const r: any = (data as any[])[0];
      const cityHref = r.city_key
        ? `/leaderboard?city=${encodeURIComponent(r.city_key)}`
        : `/leaderboard`;
      L.popup({ maxWidth: 260 })
        .setLatLng([lat, lng])
        .setContent(
          `<div style="font-family:inherit">
            <div style="display:flex;gap:8px;align-items:center">
              <img src="${r.image_url}" style="width:44px;height:44px;border-radius:6px;object-fit:cover"/>
              <div>
                <div style="font-weight:600">${escapeHtml(r.nickname || "Spider")}</div>
                <div style="font-size:11px;opacity:0.75">${escapeHtml(r.location_name || "Unknown area")}</div>
                <div style="font-size:11px">⚡ ${r.power_score} · top of ${r.area_count} nearby</div>
              </div>
            </div>
            <a href="${cityHref}" style="display:inline-block;margin-top:6px;font-size:12px;color:#60a5fa">View city leaderboard →</a>
          </div>`
        )
        .openOn(map);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
    };
  }, [globalCount]);

  // Fetch and render heat data
  useEffect(() => {
    if (globalCount === null || globalCount < 10) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const daysBack = range === "week" ? 7 : range === "month" ? 30 : null;
      const { data, error } = await supabase.rpc("get_spider_upload_heatmap", {
        days_back: daysBack,
      });
      if (cancelled) return;
      if (error) {
        console.error("Heatmap fetch error", error);
        setLoading(false);
        return;
      }

      const points: [number, number, number][] = (data || [])
        .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number")
        .map((s) => [s.latitude as number, s.longitude as number, 1]);

      setCount(points.length);

      if (mapRef.current) {
        if (heatRef.current) {
          mapRef.current.removeLayer(heatRef.current);
          heatRef.current = null;
        }
        if (points.length > 0) {
          // @ts-ignore - heatLayer added by leaflet.heat
          heatRef.current = L.heatLayer(points, {
            radius: 30,
            blur: 18,
            minOpacity: 0.55,
            maxZoom: 12,
            gradient: {
              0.1: "#1e3a8a",
              0.3: "#2563eb",
              0.5: "#10b981",
              0.7: "#facc15",
              0.85: "#f97316",
              1.0: "#dc2626",
            },
          }).addTo(mapRef.current);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range, globalCount]);

  // Pre-threshold CTA
  if (globalCount !== null && globalCount < 10) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            Put your city on the map
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1">
            We need <strong>{10 - globalCount}</strong> more spider{10 - globalCount === 1 ? "" : "s"} with locations
            before the global heat map unlocks. Tag your next spider's location to help kickstart your city's league.
          </p>
          <Button asChild>
            <Link to="/upload"><Upload className="h-4 w-4 mr-2" />Upload a spider</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            Spider Upload Heat Map <span className="text-xs font-normal text-muted-foreground ml-1">beta</span>
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setRange(r)}
              >
                {RANGE_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading sightings…" : `${count} spider${count === 1 ? "" : "s"} mapped · tap a hotspot to see its top spider`}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative overflow-hidden rounded-xl border border-border/50">
          <div ref={mapEl} className="h-[360px] w-full bg-muted" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}