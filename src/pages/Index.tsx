import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trophy, Users, Sword, Loader2 } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const { user, signOut, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
            <div>
              <h1 className="text-2xl font-bold">Spider League</h1>
              <p className="text-sm text-muted-foreground">Welcome back, fighter!</p>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <Link to="/upload" className="block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Upload Spider</CardTitle>
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>Add a new fighter to your collection</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <Link to="/collection" className="block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">My Collection</CardTitle>
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <CardDescription>View and manage your spiders</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Battles</CardTitle>
                <Sword className="h-5 w-5 text-primary" />
              </div>
              <CardDescription>Coming soon...</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Leaderboard</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardDescription>Coming soon...</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Welcome Section */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              New to Spider League? Here's how to begin your journey:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1">1. Upload Your Spider</h3>
                <p className="text-sm text-muted-foreground">Take a photo and we'll generate battle stats</p>
              </div>
              <div className="text-center p-4 border rounded-lg opacity-60">
                <Sword className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1">2. Enter Battles</h3>
                <p className="text-sm text-muted-foreground">Compete in weekly matchups (coming soon)</p>
              </div>
              <div className="text-center p-4 border rounded-lg opacity-60">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1">3. Climb Rankings</h3>
                <p className="text-sm text-muted-foreground">Rise through the leagues (coming soon)</p>
              </div>
            </div>
            
            <div className="text-center pt-4">
              <Button asChild size="lg">
                <Link to="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Spider
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
