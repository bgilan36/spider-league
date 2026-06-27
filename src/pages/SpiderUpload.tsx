import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, Loader2, ArrowLeft, MapPin, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { classifyImage } from "@/hooks/useImageClassifier";
import { useBadgeSystem } from "@/hooks/useBadgeSystem";
import heic2any from "heic2any";
import SpiderRevealCard from "@/components/SpiderRevealCard";
import NewSpeciesReveal from "@/components/dex/NewSpeciesReveal";
import { matchSpeciesSlug, getDexSpecies } from "@/lib/spiderDex/species";

const AUTO_LOCATION_TIMEOUT_MS = 1500;
const MANUAL_LOCATION_TIMEOUT_MS = 2500;
const GEOCODE_TIMEOUT_MS = 1200;
const LOCATION_CACHE_AGE_MS = 10 * 60 * 1000;

const titleCase = (str: string) =>
  str
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

const generateNickname = (species: string) => {
  const adjectives = [
    "Shadow",
    "Crimson",
    "Iron",
    "Silk",
    "Night",
    "Ember",
    "Storm",
    "Ghost",
    "Venom",
    "Glimmer",
  ];
  const nouns = [
    "Weaver",
    "Stalker",
    "Spinner",
    "Fang",
    "Crawler",
    "Prowler",
    "Skitter",
    "Bite",
    "Warden",
    "Hunter",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const hint = species.split(" ")[0];
  return `${adj}${noun} ${hint}`.trim();
};

async function ensureJpeg(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  const isHeic = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(name);
  if (!isHeic) return file;
  try {
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(converted) ? (converted[0] as Blob) : (converted as Blob);
    return new File([blob], name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("HEIC to JPEG conversion failed, using original file", e);
    return file;
  }
}

const SpiderUpload = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkAndAwardBadges } = useBadgeSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [spiderStats, setSpiderStats] = useState<any | null>(null);
  const [analysisSource, setAnalysisSource] = useState<'server' | 'local' | null>(null);
  const [candidates, setCandidates] = useState<Array<{
    species: string;
    confidence: number;
    isUSNative: boolean;
    harmfulToHumans: string;
    specialAbilities: string[];
    rank: number;
    reasoning?: string;
  }>>([]);
  const [identificationQuality, setIdentificationQuality] = useState<string | null>(null);
  const [safetyInfo, setSafetyInfo] = useState<{
    isUSNative: boolean;
    harmfulToHumans: string;
    dangerLevel: string;
    specialAbilities: string[];
  } | null>(null);
  const [weeklyUploadCount, setWeeklyUploadCount] = useState<number>(0);
  const [revealOpen, setRevealOpen] = useState(false);
  const [newSpeciesReveal, setNewSpeciesReveal] = useState<{
    commonName: string;
    scientificName?: string;
    imageUrl: string;
    xpAwarded: number;
    badgeUnlocked?: string | null;
    distinctSpecies: number;
    nextNav: { spiderId: string; afterBattle: boolean };
  } | null>(null);

  // Location tagging
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [locationOptIn, setLocationOptIn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Default ON — user can tap Skip to disable.
    return localStorage.getItem("spider_location_optin") !== "false";
  });

  const [pendingSpecies, setPendingSpecies] = useState<string | null>(null);
  const [pendingNickname, setPendingNickname] = useState<string | null>(null);
  const [pendingStats, setPendingStats] = useState<any | null>(null);
  const [pendingSafety, setPendingSafety] = useState<any | null>(null);

  const fetchWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        GEOCODE_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error("reverse geocode failed");
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
  };

  const forwardGeocode = async (query: string): Promise<{ lat: number; lng: number; name: string } | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
        GEOCODE_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error("forward geocode failed");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const place = data[0];
      const lat = parseFloat(place.lat);
      const lng = parseFloat(place.lon);
      const a = place.address || {};
      const parts = [
        a.city || a.town || a.village || a.hamlet || a.suburb || a.county,
        a.state || a.region,
        a.country,
      ].filter(Boolean);
      const name = parts.join(", ") || place.display_name || query;
      return { lat, lng, name };
    } catch {
      return null;
    }
  };

  const getFastPosition = (timeoutMs: number) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      let settled = false;
      const failTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Location timed out. Type a city instead."));
      }, timeoutMs);

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
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: LOCATION_CACHE_AGE_MS },
      );
    });

  const applyDetectedLocation = async (pos: GeolocationPosition) => {
    const { latitude: rawLat, longitude: rawLng } = pos.coords;
    const { fuzzCoords } = await import("@/lib/fuzzLocation");
    const { lat, lng } = fuzzCoords(rawLat, rawLng, 1000);
    setLatitude(lat);
    setLongitude(lng);
    setLocationAccuracy(1000);
    setLocationOptIn(true);
    localStorage.setItem("spider_location_optin", "true");
    const fallback = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    setLocationName(fallback);
    reverseGeocode(lat, lng).then((name) => {
      if (name && name !== fallback) setLocationName(name);
    }).catch(() => {});
  };

  const useMyLocation = async (opts?: { silent?: boolean }) => {
    if (!("geolocation" in navigator)) {
      if (!opts?.silent) {
        toast({
          title: "Location unavailable",
          description: "Your device doesn't support geolocation.",
          variant: "destructive",
        });
      }
      return;
    }
    setLocationLoading(true);
    try {
      const pos = await getFastPosition(opts?.silent ? AUTO_LOCATION_TIMEOUT_MS : MANUAL_LOCATION_TIMEOUT_MS);
      await applyDetectedLocation(pos);
      if (!opts?.silent) toast({ title: "Location captured (fuzzed ~1km)" });
    } catch (err: any) {
      if (!opts?.silent) {
        toast({
          title: "Couldn't get location quickly",
          description: err?.message || "Type a city to tag this spider instead.",
          variant: "destructive",
        });
      }
    } finally {
      setLocationLoading(false);
    }
  };

  const searchCity = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setCitySearchLoading(true);
    try {
      const result = await forwardGeocode(q);
      if (result) {
        const { fuzzCoords } = await import("@/lib/fuzzLocation");
        const { lat, lng } = fuzzCoords(result.lat, result.lng, 1000);
        setLatitude(lat);
        setLongitude(lng);
        setLocationName(result.name);
        setLocationAccuracy(1000);
        setLocationOptIn(true);
        localStorage.setItem("spider_location_optin", "true");
        toast({ title: "Location set", description: result.name });
      } else {
        setLatitude(null);
        setLongitude(null);
        setLocationName(q);
        setLocationAccuracy(null);
        setLocationOptIn(true);
        localStorage.setItem("spider_location_optin", "true");
        toast({ title: "Location saved", description: "Using the city name without coordinates." });
      }
    } finally {
      setCitySearchLoading(false);
    }
  };

  const clearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationName("");
    setLocationAccuracy(null);
  };

  // Auto-prompt for location once the user has opted in previously
  useEffect(() => {
    if (locationOptIn && latitude === null && !locationLoading && selectedFile) {
      useMyLocation({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  useEffect(() => {
    const fetchWeeklyUploadCount = async () => {
      if (!user) return;
      
      try {
        // Use Sunday-based week start to match battle eligibility checks
        const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const dayOfWeek = ptNow.getDay();
        
        const weekStart = new Date(ptNow);
        weekStart.setDate(ptNow.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        
        const { data, error } = await supabase
          .from('weekly_uploads')
          .select('upload_count')
          .eq('user_id', user.id)
          .eq('week_start', weekStart.toISOString().split('T')[0])
          .maybeSingle();
        
        if (error) throw error;
        setWeeklyUploadCount(data?.upload_count || 0);
      } catch (error) {
        console.error('Error fetching weekly upload count:', error);
      }
    };
    
    fetchWeeklyUploadCount();
  }, [user]);

  // Check for pending file upload from Index page
  useEffect(() => {
    const pendingFile = sessionStorage.getItem('pendingUploadFile');
    if (pendingFile) {
      try {
        const fileData = JSON.parse(pendingFile);
        // Convert base64 back to File object
        fetch(fileData.data)
          .then(res => res.blob())
          .then(async (blob) => {
            const file = new File([blob], fileData.name, { type: fileData.type });
            const converted = await ensureJpeg(file);
            setSelectedFile(converted);
            setPreviewUrl(URL.createObjectURL(converted));
            await analyzeImage(converted);
            // Clear the pending file
            sessionStorage.removeItem('pendingUploadFile');
          });
      } catch (error) {
        console.error('Error loading pending file:', error);
        sessionStorage.removeItem('pendingUploadFile');
      }
    }
  }, []);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Compress image on-device to improve AI reliability and latency
  const compressImageToBase64 = (file: File, maxDim = 1024, quality = 0.85) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const analyzeImage = async (file: File) => {
    setAnalysisSource(null);
    setCandidates([]);
    setIdentificationQuality(null);
    setSafetyInfo(null);
    try {
      setIdentifying(true);
      toast({ title: 'Analyzing spider...', description: 'Please wait while we identify your spider.' });
      
      const base64 = await compressImageToBase64(file, 1024, 0.85);
const { data, error } = await supabase.functions.invoke('spider-identify', {
        body: {
          image: base64,
          topK: 8,
          // Location context greatly improves species ID accuracy
          // (e.g. western vs southern black widow, regional tarantulas).
          location: (latitude !== null && longitude !== null)
            ? { latitude, longitude, name: locationName || null }
            : (locationName ? { name: locationName } : null),
        }
      });
      
      if (error) throw error;
      
      // Handle enhanced response format
      if (data?.species) {
        setSpecies(data.species);
        setAnalysisSource('server');
        console.log('AI identified species:', data.species);
      }
      if (data?.nickname) {
        setNickname(data.nickname);
        console.log('AI suggested nickname:', data.nickname);
      }
      if (data?.attributes) {
        setSpiderStats({
          ...data.attributes,
          rarity: data.attributes.rarity
        });
        console.log('AI generated stats:', data.attributes);
      }
      
      // Store top 3 candidates
      if (Array.isArray(data?.topCandidates)) {
        setCandidates(data.topCandidates);
      }
      
      // Store identification quality
      if (data?.identificationQuality) {
        setIdentificationQuality(data.identificationQuality);
      }
      
      // Store safety information
      if (data?.isUSNative !== undefined) {
        setSafetyInfo({
          isUSNative: data.isUSNative,
          harmfulToHumans: data.harmfulToHumans || 'Unknown',
          dangerLevel: data.dangerLevel || 'unknown',
          specialAbilities: data.specialAbilities || []
        });
      }
      
      // Show success message with confidence
      if (data?.species && data?.nickname) {
        const confidenceText = data.confidence >= 85 ? 'High confidence' : 
                              data.confidence >= 70 ? 'Good confidence' :
                              data.confidence >= 50 ? 'Moderate confidence' : 'Low confidence';
        toast({ 
          title: `Spider identified! (${confidenceText})`, 
          description: `Meet ${data.nickname} - ${data.species}!` 
        });
        // Trigger the magical card reveal
        setRevealOpen(true);
      }
    } catch (err: any) {
      console.error('AI identification failed:', err);
      // Fallback: run a lightweight on-device classifier in the browser
      try {
        toast({
          title: 'Analyzing with backup method...',
          description: 'Please wait while we try another approach.',
        });

        const base64Local = await fileToBase64(file);
        const resultObj = await classifyImage(base64Local);

        if (resultObj?.results?.length) {
          const top = resultObj.topResult || resultObj.results[0];
          const primaryLabel = String(top.label || '').split(',')[0];
          const speciesLocal = titleCase(primaryLabel);
          setSpecies(speciesLocal);
          setAnalysisSource('local');
          
          // Map local classifier results to new format
          const mappedCandidates = resultObj.results.slice(0, 3).map((r: any, idx: number) => ({
            species: titleCase(r.label),
            confidence: Math.round((r.score || 0) * 100),
            isUSNative: false, // Local classifier doesn't know
            harmfulToHumans: 'Unknown - local identification only',
            specialAbilities: [],
            rank: idx + 1
          }));
          setCandidates(mappedCandidates);

          const nick = generateNickname(speciesLocal);
          setNickname(nick);

          const statsLocal = generateSpiderStats(speciesLocal);
          setSpiderStats(statsLocal);

          toast({
            title: 'Spider analyzed!',
            description: `Meet ${nick} — ${speciesLocal}! (Local backup method)`,
          });
          setRevealOpen(true);
        } else {
          throw new Error('No results from on-device classifier');
        }
      } catch (fallbackErr: any) {
        console.error('Fallback classification failed:', fallbackErr);
        toast({
          title: 'No spider detected',
          description: 'Please upload an image containing a spider. You can also enter details manually.',
          variant: 'destructive',
        });
      }
    } finally {
      setIdentifying(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    if (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)) {
      const converted = await ensureJpeg(file);
      setSelectedFile(converted);
      setPreviewUrl(URL.createObjectURL(converted));
      await analyzeImage(converted);
    } else {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
    }
  }
  };

const applySpeciesBias = (speciesName: string, stats: { hit_points: number; damage: number; speed: number; defense: number; venom: number; webcraft: number; }) => {
  const s = (speciesName || "").toLowerCase();
  let { hit_points, damage, speed, defense, venom, webcraft } = stats;
  const clamp = (n: number) => Math.max(10, Math.min(100, Math.round(n)));

  // Specific high-risk species first (ScienceFocus & SpiderSpotter informed)
  if (s.includes('funnel') || s.includes('funnel-web') || s.includes('atrax') || s.includes('hadronyche')) {
    // Sydney funnel-web and relatives
    venom = 100;
    damage = Math.max(damage, 85);
    speed = Math.max(speed, 80);
    defense = Math.max(defense, 80);
    hit_points = Math.max(hit_points, 75);
    webcraft = Math.max(webcraft, 70);
  } else if ((s.includes('phoneutria') || s.includes('wandering')) || (s.includes('banana') && !s.includes('orb') && !s.includes('nephila'))) {
    // Brazilian wandering spider
    venom = Math.max(venom, 98);
    damage = Math.max(damage, 85);
    speed = Math.max(speed, 90);
    defense = Math.max(defense, 65);
    hit_points = Math.max(hit_points, 70);
    webcraft = Math.min(webcraft, 40);
  } else if (s.includes('sicarius') || (s.includes('six') && s.includes('eye') && s.includes('sand'))) {
    // Six-eyed sand spider
    venom = Math.max(venom, 97);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 55);
    defense = Math.max(defense, 80);
    hit_points = Math.max(hit_points, 65);
    webcraft = Math.min(webcraft, 30);
  } else if (s.includes('redback') || s.includes('hasselti')) {
    // Australian redback (widow-type)
    venom = Math.max(venom, 97);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 60);
    webcraft = Math.min(webcraft, 50);
    hit_points = Math.max(hit_points, 55);
  } else if (s.includes('missulena') || (s.includes('mouse') && s.includes('spider'))) {
    // Mouse spider
    venom = Math.max(venom, 92);
    damage = Math.max(damage, 75);
    speed = Math.max(speed, 70);
    defense = Math.max(defense, 70);
    hit_points = Math.max(hit_points, 65);
    webcraft = Math.min(webcraft, 45);
  } else if (s.includes('widow') || s.includes('latrodectus')) {
    venom = Math.max(venom, 95);
    damage = Math.max(damage, 70);
    speed = Math.min(speed, 60);
    webcraft = Math.min(webcraft, 50);
    hit_points = Math.max(hit_points, 55);
  } else if (s.includes('recluse') || s.includes('loxosceles')) {
    venom = Math.max(venom, 90);
    damage = Math.max(damage, 70);
    webcraft = Math.min(webcraft, 50);
  } else if (s.includes('tarantula') || s.includes('theraphosa') || s.includes('aphonopelma')) {
    hit_points = Math.max(hit_points, 95);
    defense = Math.max(defense, 80);
    damage = Math.max(damage, 80);
    speed = Math.min(speed, 55);
    venom = Math.min(venom, 60);
    webcraft = Math.min(webcraft, 60);
  } else if (
    s.includes('barn') || s.includes('orb') || s.includes('weaver') || s.includes('garden') || s.includes('nephila') || s.includes('golden orb') ||
    (s.includes('banana') && (s.includes('orb') || s.includes('nephila')))
  ) {
    // Orb-weavers
    webcraft = Math.max(webcraft, 80);
    venom = Math.min(venom, 45);
    damage = Math.min(damage, 65);
    defense = Math.max(defense, 60);
    hit_points = Math.max(hit_points, 60);
  } else if (s.includes('wolf') || s.includes('lycosa')) {
    speed = Math.max(speed, 85);
    damage = Math.max(damage, 75);
    webcraft = Math.min(webcraft, 40);
    venom = Math.max(venom, 60);
    hit_points = Math.max(hit_points, 70);
  } else if (s.includes('jump') || s.includes('salticidae')) {
    speed = Math.max(speed, 80);
    damage = Math.max(damage, 65);
    webcraft = Math.min(webcraft, 35);
    hit_points = Math.max(hit_points, 55);
    defense = Math.max(defense, 55);
  } else if (s.includes('huntsman') || s.includes('heteropoda')) {
    speed = Math.max(speed, 90);
    damage = Math.max(damage, 75);
    hit_points = Math.max(hit_points, 80);
    webcraft = Math.min(webcraft, 30);
  }

  return {
    hit_points: clamp(hit_points),
    damage: clamp(damage),
    speed: clamp(speed),
    defense: clamp(defense),
    venom: clamp(venom),
    webcraft: clamp(webcraft),
  };
};

  const generateSpiderStats = (speciesName?: string) => {
    // Generate random stats, then bias by species if available
    const baseStats = {
      hit_points: Math.floor(Math.random() * 50) + 50, // 50-100
      damage: Math.floor(Math.random() * 30) + 20, // 20-50
      speed: Math.floor(Math.random() * 40) + 30, // 30-70
      defense: Math.floor(Math.random() * 35) + 25, // 25-60
      venom: Math.floor(Math.random() * 45) + 15, // 15-60
      webcraft: Math.floor(Math.random() * 40) + 20, // 20-60
    };

    const targetSpecies = speciesName ?? species;
    const biased = targetSpecies ? applySpeciesBias(targetSpecies, baseStats) : baseStats;
    const power_score = Object.values(biased).reduce((sum, stat) => sum + (stat as number), 0);

    // Percentile-aligned tiers (DB trigger is source of truth; this keeps the
    // upload preview honest). Common 0–50, Uncommon 50–80, Rare 80–93,
    // Epic 93–98, Legendary 98+.
    let rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 453) rarity = "LEGENDARY";
    else if (power_score >= 368) rarity = "EPIC";
    else if (power_score >= 323) rarity = "RARE";
    else if (power_score >= 300) rarity = "UNCOMMON";
    else rarity = "COMMON";

    return {
      ...biased,
      power_score,
      rarity,
    };
  };

  const confirmPendingSpecies = () => {
    if (!pendingSpecies) return;
    setSpecies(pendingSpecies);
    setNickname(pendingNickname || generateNickname(pendingSpecies));
    if (pendingStats) setSpiderStats(pendingStats);
    if (pendingSafety) setSafetyInfo(pendingSafety);
    setPendingSpecies(null);
    setPendingNickname(null);
    setPendingStats(null);
    setPendingSafety(null);
    toast({ title: "Species saved", description: pendingSpecies });
  };

  const cancelPendingSpecies = () => {
    setPendingSpecies(null);
    setPendingNickname(null);
    setPendingStats(null);
    setPendingSafety(null);
  };

  useEffect(() => {
    setPendingSpecies(null);
    setPendingNickname(null);
    setPendingStats(null);
    setPendingSafety(null);
  }, [species]);

  const handleUpload = async (e?: React.FormEvent, opts?: { afterBattle?: boolean }) => {
    if (e) e.preventDefault();
    if (!user || !selectedFile || !nickname.trim() || !species.trim()) {
      toast({ title: "Missing information", description: "Please fill all fields and select an image.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Check if user is authenticated
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error("You must be logged in to upload spiders");
      }

      // No active spider cap — user can always upload. If Starting 5 is full,
      // they'll be prompted to retire one after returning to the dashboard.


      // Upload image to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${authUser.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('spiders')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('spiders')
        .getPublicUrl(fileName);

      // Generate or reuse AI stats
      const finalStats = spiderStats || generateSpiderStats();

      // Create spider record with authenticated user ID
      const { data: insertData, error: insertError } = await supabase
        .from('spiders')
        .insert({
          owner_id: authUser.id, // Use the authenticated user ID directly
          nickname: nickname.trim(),
          species: species.trim(),
          image_url: publicUrl,
          rng_seed: Math.random().toString(36).substring(7),
          is_approved: true,
          latitude: latitude,
          longitude: longitude,
          location_name: locationName.trim() || null,
          location_accuracy_m: locationAccuracy,
          ...finalStats,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // If the user attached a location, ensure their profile opts into sharing it.
      if (latitude !== null && longitude !== null) {
        await supabase
          .from("profile_settings")
          .upsert(
            { id: authUser.id, share_spider_locations: true },
            { onConflict: "id" },
          );
      }

      // Track weekly upload
      const { error: trackError } = await supabase.rpc('increment_weekly_upload', {
        user_id_param: authUser.id,
        spider_id_param: insertData.id
      });
      
      if (trackError) {
        console.error("Error tracking weekly upload:", trackError);
        // Don't fail the upload, just log the error
      } else {
        // Update local count after successful tracking
        setWeeklyUploadCount(prev => prev + 1);
      }

      toast({ title: "Spider uploaded!", description: "Your spider is ready for battle!" });
      
      // Check for new badges after successful upload
      await checkAndAwardBadges(authUser.id);

      // SpiderDex: record the catch + maybe award the +50 XP new-species bonus.
      try {
        const slug = matchSpeciesSlug(species) ??
          species.trim().toLowerCase().replace(/\s+/g, "_");
        const def = matchSpeciesSlug(species) ? getDexSpecies(matchSpeciesSlug(species)!) : null;
        const { data: claim } = await (supabase.rpc as any)(
          "claim_species_for_spider",
          { p_spider_id: insertData.id, p_species_slug: slug, p_common_name: def?.commonName ?? species.trim() },
        );
        if (claim?.new_species) {
          setNewSpeciesReveal({
            commonName: claim.common_name || def?.commonName || species.trim(),
            scientificName: def?.scientificName,
            imageUrl: publicUrl,
            xpAwarded: claim.xp_awarded ?? 50,
            badgeUnlocked: claim.badge_unlocked,
            distinctSpecies: claim.distinct_species ?? 1,
            nextNav: { spiderId: insertData.id, afterBattle: !!opts?.afterBattle },
          });
          setRevealOpen(false);
          return; // wait for user to dismiss the reveal before navigating
        }
      } catch (e) {
        console.warn("species claim failed", e);
      }

      setRevealOpen(false);
      if (opts?.afterBattle) {
        navigate("/", { state: { newSpiderId: insertData.id, autoBattle: true } });
      } else {
        navigate("/", { state: { newSpiderId: insertData.id } });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overscroll-y-contain [touch-action:pan-y] [overflow-anchor:none]">
      <Helmet>
        <title>Upload Spider — Spider League</title>
        <meta name="description" content="Upload your spider to Spider League and get battle-ready stats." />
        <link rel="canonical" href={`${window.location.origin}/upload`} />
      </Helmet>
      
      <main className="container mx-auto px-6 py-8 overscroll-y-contain [touch-action:pan-y]">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Home
            </Link>
          </div>
          
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                alt="Spider League Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Upload Your Spider</h1>
            <p className="text-muted-foreground">Upload a photo and we'll generate battle stats for your spider</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Create Your Fighter
              </CardTitle>
              <CardDescription>
                Choose an image and give your spider a name and species
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-6">
                {/* Image Upload */}
                 <div className="space-y-2">
                   <Label>Spider Image</Label>
                   <div 
                     className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors ${!previewUrl ? 'animate-pulse ring-1 ring-primary/20' : ''}`}
                     onClick={() => fileInputRef.current?.click()}
                   >
                    {previewUrl ? (
                      <div className="space-y-4">
                        <img 
                          src={previewUrl} 
                          alt="Spider preview for identification" 
                          className="mx-auto max-h-48 rounded-lg object-cover"
                          loading="lazy"
                        />
                        <p className="text-sm text-muted-foreground">Click to change image</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="text-lg font-medium">Upload spider image</p>
                          <p className="text-sm text-muted-foreground">Click to browse files</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                 {/* Spider Details */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname" className="flex items-center gap-2">
                      Spider Nickname
                      {identifying && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </Label>
                    <Input
                      id="nickname"
                      placeholder={identifying ? "AI is generating..." : "e.g., Shadowweaver"}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      disabled={identifying}
                      required
                    />
                    {nickname && !identifying && (
                      <p className="text-xs text-muted-foreground">
                        ✨ Auto-generated by {analysisSource === 'server' ? 'Server AI' : analysisSource === 'local' ? 'Local AI' : 'AI'} (editable)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="species" className="flex items-center gap-2">
                      Species
                      {identifying && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </Label>
                    <Input
                      id="species"
                      placeholder={identifying ? "AI is identifying..." : "e.g., Black Widow"}
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      disabled={identifying}
                      required
                    />
                    {species && !identifying && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          ✨ Auto-identified by {analysisSource === 'server' ? 'Server AI' : analysisSource === 'local' ? 'Local AI' : 'AI'} (editable)
                        </p>
                        {selectedFile && !identifying && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => analyzeImage(selectedFile)}
                            className="h-6 px-2 text-xs"
                          >
                            Re-analyze
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {candidates.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Top 3 Species Matches</Label>
                      {candidates[0]?.confidence !== undefined && (
                        <span className="text-xs font-semibold">
                          {candidates[0].confidence}% match
                        </span>
                      )}
                    </div>
                    {identificationQuality && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={
                          identificationQuality === 'very_high' ? 'default' :
                          identificationQuality === 'high' ? 'secondary' : 'outline'
                        }>
                          {identificationQuality === 'very_high' ? 'Very High' :
                           identificationQuality === 'high' ? 'High' :
                           identificationQuality === 'medium' ? 'Medium' : 'Low'} Confidence
                        </Badge>
                      </div>
                    )}
                    <div className="space-y-2">
                      {candidates.slice(0, 3).map((c, i) => (
                        <div
                          key={c.species + i}
                          className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => {
                            setSpecies(c.species);
                            const nick = generateNickname(c.species);
                            setNickname(nick);
                            const updated = generateSpiderStats(c.species);
                            setSpiderStats(updated);
                            setSafetyInfo({
                              isUSNative: c.isUSNative,
                              harmfulToHumans: c.harmfulToHumans,
                              dangerLevel: c.harmfulToHumans.toLowerCase().startsWith('yes') ? 'high' : 'low',
                              specialAbilities: c.specialAbilities,
                            });
                            toast({ 
                              title: 'Match selected', 
                              description: `${c.species} — ${c.confidence}% confidence` 
                            });
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={i === 0 ? 'default' : 'outline'} className="text-xs">
                                  #{c.rank}
                                </Badge>
                                <span className="font-medium">{c.species}</span>
                                {c.isUSNative && (
                                  <Badge variant="secondary" className="text-xs">US Native</Badge>
                                )}
                              </div>
                              {c.reasoning && (
                                <p className="text-xs text-foreground/80 line-clamp-2">
                                  {c.reasoning}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {c.harmfulToHumans}
                              </p>
                              {c.specialAbilities && c.specialAbilities.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {c.specialAbilities.slice(0, 3).map((ability, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {ability}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <Badge>{c.confidence}%</Badge>
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${c.confidence}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Battle Stats Preview */}
                {spiderStats && !identifying && (
                  <div className="border rounded-lg p-4 bg-primary/5 space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      ⚔️ Battle Attributes
                      {spiderStats.rarity && (
                        <Badge className={`text-xs text-white ${
                          spiderStats.rarity === 'LEGENDARY' ? 'bg-amber-500' :
                          spiderStats.rarity === 'EPIC' ? 'bg-purple-500' :
                          spiderStats.rarity === 'RARE' ? 'bg-blue-500' :
                          spiderStats.rarity === 'UNCOMMON' ? 'bg-green-500' : 'bg-gray-500'
                        }`}>
                          {spiderStats.rarity}
                        </Badge>
                      )}
                      {spiderStats.power_score && (
                        <span className="text-xs font-medium text-muted-foreground ml-auto">⚡ {spiderStats.power_score} Power</span>
                      )}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Hit Points', value: spiderStats.hit_points, icon: '❤️' },
                        { label: 'Damage', value: spiderStats.damage, icon: '⚔️' },
                        { label: 'Speed', value: spiderStats.speed, icon: '💨' },
                        { label: 'Defense', value: spiderStats.defense, icon: '🛡️' },
                        { label: 'Venom', value: spiderStats.venom, icon: '☠️' },
                        { label: 'Webcraft', value: spiderStats.webcraft, icon: '🕸️' },
                      ].map(stat => (
                        <div key={stat.label} className="flex items-center gap-2 bg-background rounded-md p-2 border">
                          <span className="text-sm">{stat.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
                            <p className="text-sm font-bold">{stat.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {safetyInfo && (
                  <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold">Safety Information</Label>
                      {safetyInfo.isUSNative && (
                        <Badge variant="secondary" className="text-xs">US Native Species</Badge>
                      )}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Harmful to Humans: </span>
                        <span className={
                          safetyInfo.harmfulToHumans.toLowerCase().startsWith('yes') 
                            ? 'text-destructive font-medium' 
                            : 'text-muted-foreground'
                        }>
                          {safetyInfo.harmfulToHumans}
                        </span>
                      </div>
                      {safetyInfo.specialAbilities && safetyInfo.specialAbilities.length > 0 && (
                        <div>
                          <span className="font-medium">Special Abilities: </span>
                          <span className="text-muted-foreground">
                            {safetyInfo.specialAbilities.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location tagging */}
                <div className={`border-2 rounded-lg p-4 space-y-3 transition-colors ${
                  latitude !== null || locationName
                    ? "border-primary/40 bg-primary/5"
                    : "border-dashed border-primary/50 bg-primary/5"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Tag location <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    {(latitude !== null || locationName) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearLocation}
                        className="h-7 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>Use my location</strong> for a one-tap GPS tag, or <strong>type a place</strong> below
                    (e.g., "Austin, TX"). Locations are fuzzed to ~1&nbsp;km — your home address is never stored.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="default"
                      onClick={() => useMyLocation()}
                      disabled={locationLoading}
                      className="sm:w-auto"
                    >
                      {locationLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4 mr-2" />
                      )}
                      Use my location
                    </Button>
                    <div className="flex flex-1 gap-2">
                      <Input
                        placeholder="Or type a city (e.g., Austin, TX)"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchCity(locationName);
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="default"
                        onClick={() => searchCity(locationName)}
                        disabled={citySearchLoading || !locationName.trim()}
                      >
                        {citySearchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {latitude !== null && longitude !== null ? (
                      <p className="text-xs text-muted-foreground">
                        📍 {latitude.toFixed(3)}, {longitude.toFixed(3)} · fuzzed ~1&nbsp;km
                      </p>
                    ) : <span />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearLocation();
                        setLocationOptIn(false);
                        localStorage.setItem("spider_location_optin", "false");
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground"
                    >
                      Skip location
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={uploading || identifying}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {identifying ? 'Identifying...' : 'Creating Spider...'}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Create Spider
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {spiderStats && (
        <SpiderRevealCard
          open={revealOpen}
          onOpenChange={setRevealOpen}
          previewUrl={previewUrl}
          nickname={nickname}
          species={species}
          onNicknameChange={setNickname}
          stats={spiderStats}
          safety={safetyInfo}
          uploading={uploading}
          onAddToStarting5={() => handleUpload()}
          onBattleNow={() => handleUpload(undefined, { afterBattle: true })}
          candidates={candidates}
          onSelectCandidate={(picked) => {
            if (picked === species) {
              cancelPendingSpecies();
              return;
            }
            setPendingSpecies(picked);
            setPendingNickname(generateNickname(picked));
            setPendingStats(generateSpiderStats(picked));
            const candidate = candidates.find((c) => c.species === picked);
            if (candidate) {
              setPendingSafety({
                isUSNative: candidate.isUSNative,
                harmfulToHumans: candidate.harmfulToHumans,
                dangerLevel: candidate.harmfulToHumans.toLowerCase().startsWith('yes') ? 'high' : 'low',
                specialAbilities: candidate.specialAbilities,
              });
            }
          }}
          pendingSpecies={pendingSpecies}
          pendingNickname={pendingNickname}
          pendingStats={pendingStats}
          pendingSafety={pendingSafety}
          onConfirmSpecies={confirmPendingSpecies}
          onCancelPreview={cancelPendingSpecies}
          locationName={locationName}
          hasLocation={latitude !== null || !!locationName}
          locationLoading={locationLoading}
          citySearchLoading={citySearchLoading}
          onLocationNameChange={setLocationName}
          onUseMyLocation={useMyLocation}
          onSearchCity={searchCity}
          onClearLocation={clearLocation}
        />
      )}
      {newSpeciesReveal && (
        <NewSpeciesReveal
          open={!!newSpeciesReveal}
          commonName={newSpeciesReveal.commonName}
          scientificName={newSpeciesReveal.scientificName}
          imageUrl={newSpeciesReveal.imageUrl}
          xpAwarded={newSpeciesReveal.xpAwarded}
          badgeUnlocked={newSpeciesReveal.badgeUnlocked}
          distinctSpecies={newSpeciesReveal.distinctSpecies}
          onClose={() => {
            const nav = newSpeciesReveal.nextNav;
            setNewSpeciesReveal(null);
            navigate("/", {
              state: nav.afterBattle
                ? { newSpiderId: nav.spiderId, autoBattle: true }
                : { newSpiderId: nav.spiderId },
            });
          }}
        />
      )}
    </div>
  );
};

export default SpiderUpload;