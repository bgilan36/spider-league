import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { Upload, Trophy, Users, Sword } from "lucide-react";

const Index = () => {
  const { user, signOut } = useAuth();
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet>
          <title>Spider League — Battle Spiders Online</title>
          <meta name="description" content="Upload spiders, generate stats, and battle in weekly matchups on Spider League." />
          <link rel="canonical" href={`${window.location.origin}/`} />
        </Helmet>
        <div className="text-center px-6 py-12">
          <h1 className="text-4xl font-bold mb-4">Spider League — Battle Spiders Online</h1>
          <p className="text-xl text-muted-foreground mb-6">Upload a spider, get a fighter profile, and compete for glory.</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
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
