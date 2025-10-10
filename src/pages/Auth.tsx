import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import spiderLogo from "@/assets/spider-league-logo.png";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const redirectUrl = `${window.location.origin}/`;

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogle = async () => {
    try {
      // Store remember preference with timestamp before OAuth redirect
      localStorage.setItem('rememberMe', Date.now().toString());
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      const url = data?.url;
      if (!url) throw new Error("No OAuth URL returned from Supabase.");

      // Prefer navigating the top window (break out of the iframe)
      if (window.top && window.top !== window.self) {
        try {
          window.top.location.href = url;
          return;
        } catch {
          // ignore and fallback to current window
        }
      }
      // Fallback: navigate in the same window
      window.location.href = url;
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Set a flag in storage based on remember me preference
        if (rememberMe) {
          localStorage.setItem('rememberMe', Date.now().toString());
        } else {
          // Use sessionStorage to track this session
          sessionStorage.setItem('tempSession', 'true');
          localStorage.removeItem('rememberMe');
        }
        
        toast({ title: "Signed in", description: "Welcome back!" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) {
          // Check if the error is about email already being registered
          if (error.message.toLowerCase().includes('already registered') || 
              error.message.toLowerCase().includes('already been registered') ||
              error.message.toLowerCase().includes('user already registered')) {
            toast({ 
              title: "Account already exists", 
              description: "This email is already registered. Try signing in with Google or use the email sign-in option.", 
              variant: "destructive" 
            });
            return;
          }
          throw error;
        }
        toast({ title: "Check your inbox", description: "Confirm your email to complete sign up." });
      }
    } catch (err: any) {
      toast({ title: "Auth error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Spider League — Sign In</title>
        <meta name="description" content="Sign in to Spider League to upload spiders and battle." />
        <link rel="canonical" href={`${window.location.origin}/auth`} />
      </Helmet>
      <main className="mx-auto max-w-md px-6 py-12">
        <div className="flex flex-col items-center mb-8">
          <img 
            src={spiderLogo} 
            alt="Spider League Logo" 
            className="h-24 w-auto mb-4"
          />
          <h1 className="text-3xl font-bold">Sign in to Spider League</h1>
        </div>
        
        <div className="mb-8 p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload photos of spiders you find, let our AI identify and score them, then battle other players in turn-based combat. Challenge friends or accept challenges from the community to see whose spider reigns supreme!
          </p>
        </div>
        
        <div className="space-y-4">
          <Button className="w-full" onClick={handleGoogle}>Continue with Google</Button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or sign in with email</span>
            </div>
          </div>
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {mode === "signin" && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe} 
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Keep me logged in for 30 days
                </Label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!email || !password}>
              {mode === "signin" ? "Sign In with Email" : "Create Account with Email"}
            </Button>
          </form>
          <div className="text-sm text-center space-y-2">
            <div>
              {mode === "signin" ? (
                <button className="underline hover:text-primary transition-colors" onClick={() => setMode("signup")}>
                  Don't have an account? Create one
                </button>
              ) : (
                <button className="underline hover:text-primary transition-colors" onClick={() => setMode("signin")}>
                  Already have an account? Sign in
                </button>
              )}
            </div>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our terms of service and privacy policy.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
