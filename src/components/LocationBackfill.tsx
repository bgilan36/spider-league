import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fuzzCoords } from "@/lib/fuzzLocation";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error("rg failed");
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.city || a.town || a.village || a.hamlet || a.suburb || a.county,
      a.state || a.region,
      a.country,
    ].filter(Boolean);
    return parts.join(", ") || data.display_name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  } catch {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }
}

interface Props {
  spiderId: string;
  ownerId: string;
  onSaved?: (info: { lat: number; lng: number; name: string }) => void;
}

export default function LocationBackfill({ spiderId, ownerId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ name: string } | null>(null);

  const run = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location unavailable", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { lat, lng } = fuzzCoords(pos.coords.latitude, pos.coords.longitude, 1000);
          const name = await reverseGeocode(lat, lng);
          const { error } = await supabase
            .from("spiders")
            .update({
              latitude: lat,
              longitude: lng,
              location_name: name,
              location_accuracy_m: 1000,
            })
            .eq("id", spiderId);
          if (error) throw error;
          await supabase
            .from("profile_settings")
            .upsert(
              { id: ownerId, share_spider_locations: true },
              { onConflict: "id" },
            );
          setDone({ name });
          onSaved?.({ lat, lng, name });
          toast({ title: "Location added", description: name });
        } catch (e: any) {
          toast({ title: "Couldn't save location", description: e.message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        toast({ title: "Couldn't get location", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  if (done) {
    return (
      <p className="text-xs text-muted-foreground">
        📍 {done.name} · fuzzed ~1&nbsp;km
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Only your spider's location is stored — never your home address.
        Locations are fuzzed to ~1&nbsp;km.
      </p>
      <Button type="button" size="sm" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <MapPin className="h-3 w-3 mr-2" />}
        Add location
      </Button>
    </div>
  );
}