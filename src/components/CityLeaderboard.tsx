import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface City { city_key: string; display_name: string; spider_count: number }
interface CitySpider {
  spider_id: string;
  owner_id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: string;
  power_score: number;
  owner_display_name: string | null;
  rank_position: number;
}

export default function CityLeaderboard() {
  const [params, setParams] = useSearchParams();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CitySpider[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const selected = params.get("city") || "";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("list_cities_with_spiders");
      setCities((data as City[]) || []);
      setLoading(false);
    })();
  }, []);

  const selectedCity = useMemo(
    () => cities.find((c) => c.city_key === selected) || cities[0],
    [cities, selected],
  );

  useEffect(() => {
    const key = selectedCity?.city_key;
    if (!key) { setRows([]); return; }
    setRowsLoading(true);
    (async () => {
      const { data } = await supabase.rpc("get_city_leaderboard", {
        p_city_key: key, p_limit: 25,
      });
      setRows((data as CitySpider[]) || []);
      setRowsLoading(false);
    })();
  }, [selectedCity?.city_key]);

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (cities.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            Top Spiders in {selectedCity?.display_name ?? "your city"}
          </CardTitle>
          <Select
            value={selectedCity?.city_key}
            onValueChange={(v) => {
              const next = new URLSearchParams(params);
              next.set("city", v);
              setParams(next, { replace: true });
            }}
          >
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.city_key} value={c.city_key}>
                  {c.display_name} ({c.spider_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Weekly resets every Sunday · #1 each week earns the <strong>Local Legend</strong> badge
        </p>
      </CardHeader>
      <CardContent>
        {rowsLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No spiders ranked here yet this week.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.spider_id} className="py-2 flex items-center gap-3">
                <span className="w-6 text-sm font-mono text-muted-foreground text-right">#{r.rank_position}</span>
                <img src={r.image_url} alt={r.nickname} className="w-9 h-9 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {r.nickname}
                    {r.rank_position === 1 && (
                      <Badge variant="default" className="gap-1 text-[10px]">
                        <Crown className="h-3 w-3" /> Local Legend
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.owner_display_name || "Anonymous"}</div>
                </div>
                <div className="text-sm font-semibold">⚡ {r.power_score}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}