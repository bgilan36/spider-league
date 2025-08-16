import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";

const Index = () => {
  const { user, signOut } = useAuth();
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
        {user ? (
          <div className="flex items-center justify-center gap-3">
            <Button variant="default" onClick={signOut}>Sign out</Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
