import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signingIn: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInAsDemo: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    console.log("AuthProvider: Setting up auth listener");
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("AuthProvider: Auth state changed", { event, hasSession: !!session });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if user should remain logged in
      if (session) {
        const rememberMe = localStorage.getItem('rememberMe');
        const tempSession = sessionStorage.getItem('tempSession');
        
        // If neither flag exists, the user didn't choose to stay logged in and browser was closed
        if (!rememberMe && !tempSession) {
          console.log("AuthProvider: Session expired (browser was closed without Remember Me)");
          supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log("AuthProvider: Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      // Keep showing loader until auth state change completes
      setTimeout(() => setSigningIn(false), 1500);
    } else {
      setSigningIn(false);
    }
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    setSigningIn(true);
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      }
    });
    if (error) {
      setSigningIn(false);
      return { error };
    }

    const url = data?.url;
    if (url) {
      try {
        if (window.top && window.top !== window.self) {
          // Break out of iframe to avoid X-Frame-Options block from Google
          window.top.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        // Fallback to opening a new tab
        window.open(url, '_blank', 'noopener,noreferrer');
        setSigningIn(false);
      }
    }
    return { error: null };
  };

  const signInAsDemo = async () => {
    setSigningIn(true);
    // Generate cryptographically secure random password
    const generateSecurePassword = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(36)).join('').slice(0, 16);
    };

    // Generate cryptographically secure random identifier for demo email
    const generateSecureId = () => {
      const array = new Uint8Array(8);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(36)).join('');
    };

    // Create a fresh ephemeral demo user with secure password and random identifier
    const demoEmail = `demo+${Date.now()}_${generateSecureId()}@spiderleague.com`;
    const password = generateSecurePassword();
    console.log('AuthProvider: Creating ephemeral demo account');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: demoEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (signUpError) {
      setSigningIn(false);
      return { error: signUpError };
    } else if (signUpData?.session) {
      // Sign up returned a session when email confirmation is disabled
      setTimeout(() => setSigningIn(false), 1500);
      return { error: null };
    } else {
      // No session returned; try signing in again with the ephemeral email
      const signInResult = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password,
      });
      if (!signInResult.error) {
        setTimeout(() => setSigningIn(false), 1500);
      } else {
        setSigningIn(false);
      }
      return { error: signInResult.error };
    }
  };
  const signOut = async () => {
    // Clear remember me flags
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('tempSession');
    await supabase.auth.signOut();
  };

  console.log("AuthProvider: Rendering with", { hasUser: !!user, loading });

  return (
    <AuthContext.Provider value={{ user, session, loading, signingIn, signOut, signIn, signUp, signInWithGoogle, signInAsDemo }}>
      {signingIn && <SpiderLogoLoader />}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
