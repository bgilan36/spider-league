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

  const handleGoogle = async () => {
    try {
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
          // ignore and fallback to new tab
        }
      }
      // Fallback: open in a new tab to avoid iframe X-Frame-Options issues
      window.open(url, "_blank", "noopener,noreferrer");
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
        <div className="space-y-4">
          <Button className="w-full" onClick={handleGoogle}>Continue with Google</Button>
          <div className="text-center text-sm text-muted-foreground">or use email</div>
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
