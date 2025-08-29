import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trophy, Users, Loader2, Lightbulb, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  power_score: number;
  is_approved: boolean;
}

const Index = () => {
  const { user, signOut, signIn, signUp, signInWithGoogle, signInAsDemo, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [spidersLoading, setSpidersLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  useEffect(() => {
    if (user) {
      fetchUserSpiders();
    } else {
      setUserSpiders([]);
      setSpidersLoading(false);
    }
  }, [user]);

  const fetchUserSpiders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, rarity, power_score, is_approved')
        .eq('owner_id', user.id)
        .order('power_score', { ascending: false })
        .limit(6);

      if (error) throw error;
      setUserSpiders(data || []);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    } finally {
      setSpidersLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        let message = error.message;
        if (error.message.includes("Invalid login credentials")) {
          message = "Invalid email or password";
        } else if (error.message.includes("User already registered")) {
          message = "This email is already registered. Try signing in instead.";
        }
        toast({ title: "Authentication Error", description: message, variant: "destructive" });
      } else {
        if (isSignUp) {
          toast({ title: "Account created!", description: "Please check your email to verify your account." });
        } else {
          toast({ title: "Welcome back!", description: "You've successfully signed in." });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet>
          <title>Spider League — Battle Spiders Online</title>
          <meta name="description" content="Upload spiders, generate stats, and battle in weekly matchups on Spider League." />
          <link rel="canonical" href={`${window.location.origin}/`} />
        </Helmet>
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png"
                alt="Spider League Logo" 
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Spider League</h1>
            <p className="text-muted-foreground">Battle Spiders Online</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
              <CardDescription>
                {isSignUp 
                  ? "Create an account to start building your spider army" 
                  : "Welcome back! Sign in to your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    setLoading(true);
                    const { error } = await signInWithGoogle();
                    if (error) {
                      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
                      setLoading(false);
                    }
                    // On success, Supabase will redirect to Google and come back
                  }}
                  disabled={loading}
                >
                  {/* Simple Google "G" svg */}
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true">
                    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.7-37-5.3-54.9H272.1v103.9h147.1c-6.2 33.6-25.6 62-54.6 80.9v67h88.4c51.7-47.6 80.5-117.9 80.5-196.9z"/>
                    <path fill="#34A853" d="M272.1 544.3c73.6 0 135.4-24.3 180.6-66.1l-88.4-67c-24.5 16.4-56 26-92.2 26-70.8 0-130.7-47.7-152.2-111.8H28.8v70.2c45 89.4 137.6 148.7 243.3 148.7z"/>
                    <path fill="#4A90E2" d="M119.9 325.4c-10.3-30.9-10.3-64.6 0-95.5V159.7H28.8c-41.9 83.7-41.9 182.4 0 266.1l91.1-70.4z"/>
                    <path fill="#FBBC05" d="M272.1 106.2c39.9-.6 78.2 14 107.5 41.1l80.1-80.1C413.1 24.6 343.7-1.2 272.1 0 166.4 0 73.8 59.3 28.8 148.7l91.1 70.2C141.4 154.8 201.3 106.9 272.1 106.2z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setLoading(true);
                    const { error } = await signInAsDemo();
                    if (error) {
                      toast({ title: "Demo sign-in failed", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Signed in as Demo User", variant: "default" });
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                >
                  🕷️ Sign in as Demo User (Development)
                </Button>
                <div className="text-center text-xs text-muted-foreground">or continue with email</div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </>
                  ) : (
                    isSignUp ? "Create Account" : "Sign In"
                  )}
                </Button>
              </form>
              
              <div className="mt-4 text-center">
                <Button 
                  variant="link" 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  {isSignUp 
                    ? "Already have an account? Sign in" 
                    : "Don't have an account? Sign up"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-center text-sm text-muted-foreground mt-6">
            Upload a spider, get a fighter profile, and compete for glory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dashboard — Spider League</title>
        <meta name="description" content="Manage your spider fighters and compete in Spider League battles." />
        <link rel="canonical" href={`${window.location.origin}/`} />
      </Helmet>
      
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                alt="Spider League Logo" 
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold">Spider League</h1>
                <p className="text-sm text-muted-foreground">Welcome back, fighter!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild>
                <Link to="/roadmap">
                  <Lightbulb className="h-4 w-4" />
                </Link>
              </Button>
              <HowItWorksModal />
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* My Collection Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">My Collection</h2>
              <p className="text-muted-foreground">Your spider fighters ranked by power</p>
            </div>
            <Button asChild className="gradient-button relative z-10">
              <Link to="/upload" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Upload Spider
              </Link>
            </Button>
          </div>

          {spidersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userSpiders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No spiders yet</h3>
                <p className="text-muted-foreground mb-6">Upload your first spider to start building your collection</p>
                <Button asChild className="gradient-button relative z-10">
                  <Link to="/upload" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Upload Your First Spider
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {userSpiders.map((spider) => (
                <div key={spider.id} className="spider-card-mini">
                  <div className="aspect-square relative mb-3 rounded-md overflow-hidden">
                    <img 
                      src={spider.image_url} 
                      alt={spider.nickname}
                      className="w-full h-full object-cover"
                    />
                    <Badge 
                      className={`absolute top-1 right-1 text-xs ${rarityColors[spider.rarity]} text-white`}
                    >
                      {spider.rarity}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <h4 className="font-medium text-sm mb-1 truncate">{spider.nickname}</h4>
                    <p className="text-xs text-muted-foreground mb-2 truncate">{spider.species}</p>
                    <div className="flex justify-center">
                      <PowerScoreArc score={spider.power_score} size="small" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <Link to="/collection" className="block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Full Collection</CardTitle>
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>View and manage all your spiders</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <Link to="/leaderboard" className="block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Leaderboard</CardTitle>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>View top-ranked spider fighters</CardDescription>
              </CardHeader>
            </Link>
          </Card>

        </div>

      </main>
    </div>
  );
};

export default Index;
