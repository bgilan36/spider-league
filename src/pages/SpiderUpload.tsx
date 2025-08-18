import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const SpiderUpload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [spiderStats, setSpiderStats] = useState<any | null>(null);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        
        // Auto-generate spider nickname and species using AI
        try {
          setIdentifying(true);
          toast({ title: 'Analyzing spider...', description: 'AI is generating nickname and species!' });
          
          const base64 = await fileToBase64(file);
          const { data, error } = await supabase.functions.invoke('spider-identify', {
            body: { image: base64, topK: 5 },
          });
          
          if (error) throw error;
          
          // Auto-populate fields (but allow user to edit)
          if (data?.species) {
            setSpecies(data.species);
            console.log('AI suggested species:', data.species);
          }
          if (data?.nickname) {
            setNickname(data.nickname);
            console.log('AI suggested nickname:', data.nickname);
          }
          if (data?.stats) {
            setSpiderStats(data.stats);
            console.log('AI generated stats:', data.stats);
          }
          
          // Show success message
          if (data?.species && data?.nickname) {
            toast({ 
              title: 'Spider analyzed!', 
              description: `Meet ${data.nickname} - ${data.species}!` 
            });
          }
        } catch (err: any) {
          console.error('AI identification failed:', err);
          toast({ 
            title: 'AI analysis failed', 
            description: 'You can enter details manually or try another image.',
            variant: "destructive" 
          });
        } finally {
          setIdentifying(false);
        }
      } else {
        toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      }
    }
  };

  const generateSpiderStats = () => {
    // Generate random stats based on rarity
    const baseStats = {
      hit_points: Math.floor(Math.random() * 50) + 50, // 50-100
      damage: Math.floor(Math.random() * 30) + 20, // 20-50
      speed: Math.floor(Math.random() * 40) + 30, // 30-70
      defense: Math.floor(Math.random() * 35) + 25, // 25-60
      venom: Math.floor(Math.random() * 45) + 15, // 15-60
      webcraft: Math.floor(Math.random() * 40) + 20, // 20-60
    };
    
    const power_score = Object.values(baseStats).reduce((sum, stat) => sum + stat, 0);
    
    // Determine rarity based on power score
    let rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    if (power_score >= 280) rarity = "LEGENDARY";
    else if (power_score >= 240) rarity = "EPIC";
    else if (power_score >= 200) rarity = "RARE";
    else rarity = "COMMON";

    return {
      ...baseStats,
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
      // Upload image to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
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

      // Create spider record
      const { error: insertError } = await supabase
        .from('spiders')
        .insert({
          owner_id: user.id,
          nickname: nickname.trim(),
          species: species.trim(),
          image_url: publicUrl,
          rng_seed: Math.random().toString(36).substring(7),
          ...finalStats,
        });

      if (insertError) throw insertError;

      toast({ title: "Spider uploaded!", description: "Your spider has been created and is pending approval." });
      navigate("/collection");
    } catch (error: any) {
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
          <div className="text-center mb-8">
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
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <p className="text-xs text-muted-foreground">✨ Auto-generated by AI (editable)</p>
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
                      <p className="text-xs text-muted-foreground">✨ Auto-identified by AI (editable)</p>
                    )}
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
    </div>
  );
};

export default SpiderUpload;