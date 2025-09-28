import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const redirectUrl = `${window.location.origin}/`;

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);


  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Signed in", description: "Welcome back!" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
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
        <h1 className="text-3xl font-bold mb-6">Sign in to Spider League</h1>
        
        <div className="mb-8 p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload photos of spiders you find, let our AI identify and score them, then battle other players in turn-based combat. Challenge friends or accept challenges from the community to see whose spider reigns supreme!
          </p>
        </div>
        
        <div className="space-y-4">
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">{mode === "signin" ? "Sign In" : "Create Account"}</Button>
          </form>
          <div className="text-sm text-center">
            {mode === "signin" ? (
              <button className="underline" onClick={() => setMode("signup")}>No account? Create one</button>
            ) : (
              <button className="underline" onClick={() => setMode("signin")}>Have an account? Sign in</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
