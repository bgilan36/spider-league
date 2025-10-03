import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { classifyImage } from "@/hooks/useImageClassifier";
import { useBadgeSystem } from "@/hooks/useBadgeSystem";
import heic2any from "heic2any";

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
  }>>([]);
  const [identificationQuality, setIdentificationQuality] = useState<string | null>(null);
  const [safetyInfo, setSafetyInfo] = useState<{
    isUSNative: boolean;
    harmfulToHumans: string;
    dangerLevel: string;
    specialAbilities: string[];
  } | null>(null);
  const [weeklyUploadCount, setWeeklyUploadCount] = useState<number>(0);

  useEffect(() => {
    const fetchWeeklyUploadCount = async () => {
      if (!user) return;
      
      try {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + diff);
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
        body: { image: base64, topK: 8 }
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

          const statsLocal = generateSpiderStats();
          setSpiderStats(statsLocal);

          toast({
            title: 'Spider analyzed!',
            description: `Meet ${nick} — ${speciesLocal}! (Local backup method)`,
          });
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

  const generateSpiderStats = () => {
    // Generate random stats, then bias by species if available
    const baseStats = {
      hit_points: Math.floor(Math.random() * 50) + 50, // 50-100
      damage: Math.floor(Math.random() * 30) + 20, // 20-50
      speed: Math.floor(Math.random() * 40) + 30, // 30-70
      defense: Math.floor(Math.random() * 35) + 25, // 25-60
      venom: Math.floor(Math.random() * 45) + 15, // 15-60
      webcraft: Math.floor(Math.random() * 40) + 20, // 20-60
    };

    const biased = species ? applySpeciesBias(species, baseStats) : baseStats;
    const power_score = Object.values(biased).reduce((sum, stat) => sum + (stat as number), 0);

    let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 280) rarity = "LEGENDARY";
    else if (power_score >= 240) rarity = "EPIC";
    else if (power_score >= 200) rarity = "RARE";
    else rarity = "COMMON";

    return {
      ...biased,
      power_score,
      rarity,
    };
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Check weekly upload limit
      const { data: canUpload, error: checkError } = await supabase.rpc('can_user_upload_this_week', { 
        user_id_param: authUser.id 
      });
      
      if (checkError) {
        console.error("Error checking upload limit:", checkError);
        throw new Error("Error checking upload permissions");
      }
      
      if (!canUpload) {
        toast({ 
          title: "Weekly limit reached", 
          description: "You can only upload 3 eligible spiders per week. Week resets on Sunday at 12am PT.", 
          variant: "destructive" 
        });
        return;
      }

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
          ...finalStats,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

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
      
      navigate("/collection");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Upload Spider — Spider League</title>
        <meta name="description" content="Upload your spider to Spider League and get battle-ready stats." />
        <link rel="canonical" href={`${window.location.origin}/upload`} />
      </Helmet>
      
      <main className="container mx-auto px-6 py-8">
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
            <div className="flex items-center justify-center gap-2 mt-4">
              <Badge variant={weeklyUploadCount >= 3 ? "destructive" : "secondary"} className="text-sm">
                {weeklyUploadCount}/3 Spiders Uploaded This Week
              </Badge>
            </div>
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
                    <Label>Top 3 Species Matches</Label>
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
                            const updated = generateSpiderStats();
                            setSpiderStats(updated);
                            toast({ 
                              title: 'Match selected', 
                              description: `${c.species} - ${c.confidence}% confidence` 
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
                            <Badge className="shrink-0">{c.confidence}%</Badge>
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
    </div>
  );
};

export default SpiderUpload;