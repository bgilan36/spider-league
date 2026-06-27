import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fuzzCoords } from "@/lib/fuzzLocation";

const LOCATION_TIMEOUT_MS = 2500;
const GEOCODE_TIMEOUT_MS = 1200;
const LOCATION_CACHE_AGE_MS = 10 * 60 * 1000;

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  let timer: number | undefined;
  try {
    const controller = new AbortController();
    timer = window.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
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
  } finally {
    if (timer) window.clearTimeout(timer);
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

  const getFastPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      let settled = false;
      const failTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Location timed out. Try again or add the city during upload."));
      }, LOCATION_TIMEOUT_MS);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(failTimer);
          resolve(pos);
        },
        (err) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(failTimer);
          reject(err);
        },
        { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: LOCATION_CACHE_AGE_MS },
      );
    });

  const run = async () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location unavailable", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const pos = await getFastPosition();
      const { lat, lng } = fuzzCoords(pos.coords.latitude, pos.coords.longitude, 1000);
      const fallback = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      setDone({ name: fallback });
      onSaved?.({ lat, lng, name: fallback });

      const { error } = await supabase
        .from("spiders")
        .update({
          latitude: lat,
          longitude: lng,
          location_name: fallback,
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
      toast({ title: "Location added", description: fallback });

      reverseGeocode(lat, lng).then(async (name) => {
        if (!name || name === fallback) return;
        setDone({ name });
        onSaved?.({ lat, lng, name });
        await supabase.from("spiders").update({ location_name: name }).eq("id", spiderId);
      }).catch(() => {});
    } catch (e: any) {
      toast({ title: "Couldn't get location quickly", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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