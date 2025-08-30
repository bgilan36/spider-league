import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      }
    });
    if (error) return { error };

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
      }
    }
    return { error: null };
  };

  const signInAsDemo = async () => {
    // Generate cryptographically secure random password
    const generateSecurePassword = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(36)).join('').slice(0, 16);
    };

    // Create a fresh ephemeral demo user with secure password
    const demoEmail = `demo+${Date.now()}@spiderleague.com`;
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
      return { error: signUpError };
    } else if (signUpData?.session) {
      // Sign up returned a session when email confirmation is disabled
      return { error: null };
    } else {
      // No session returned; try signing in again with the ephemeral email
      const signInResult = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password,
      });
      return { error: signInResult.error };
    }
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  console.log("AuthProvider: Rendering with", { hasUser: !!user, loading });

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, signIn, signUp, signInWithGoogle, signInAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
