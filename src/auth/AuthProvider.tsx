import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Setting up auth listener");
    
    // DEVELOPMENT: Auto-provide a mock user to bypass login
    const mockUser = {
      id: 'dev-user-123',
      email: 'dev@spiderleague.com',
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    } as User;

    const mockSession = {
      user: mockUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'bearer',
    } as Session;

    // Set mock user immediately for development
    setUser(mockUser);
    setSession(mockSession);
    setLoading(false);

    console.log("AuthProvider: Using mock user for development");

    // Keep auth listener for when we re-enable real auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log("AuthProvider: Auth state changed", { event: _event, hasSession: !!newSession });
      // For now, ignore real auth changes and keep using mock user
    });

    return () => {
      console.log("AuthProvider: Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  console.log("AuthProvider: Rendering with", { hasUser: !!user, loading });

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
