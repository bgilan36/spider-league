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
      }
    });
    if (!error) {
      console.log('Redirecting to Google OAuth', data?.url);
    }
    return { error };
  };

  const signInAsDemo = async () => {
    const baseEmail = 'demo@spiderleague.com';
    const password = 'demo123456';

    // 1) Try the stable demo account first
    let { error } = await supabase.auth.signInWithPassword({
      email: baseEmail,
      password,
    });

    if (!error) {
      return { error };
    }

    const needsEphemeral =
      !!error &&
      (error.message.toLowerCase().includes('email not confirmed') ||
        error.message.toLowerCase().includes('invalid'));

    // 2) Fallback: create a fresh ephemeral demo user to bypass old unconfirmed users
    if (needsEphemeral) {
      const demoEmail = `demo+${Date.now()}@spiderleague.com`;
      console.log('AuthProvider: Using ephemeral demo email', demoEmail);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        error = signUpError;
      } else if (signUpData?.session) {
        // Sign up returned a session when email confirmation is disabled
        error = null as any;
      } else {
        // No session returned; try signing in again with the ephemeral email
        const signInResult = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password,
        });
        error = signInResult.error;
      }
    } else if (error && error.message.toLowerCase().includes('email not confirmed')) {
      // Helpful message for unconfirmed email (should not occur if email confirmation is disabled)
      error = {
        message:
          'Email not confirmed. If testing locally, disable "Confirm email" in Supabase Authentication settings or delete the existing demo user and try again.',
      } as any;
    }

    return { error };
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
