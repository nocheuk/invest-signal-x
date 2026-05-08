import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]).then(([sessionResult, userResult]) => {
      if (!mounted) return;
      setSession(sessionResult.data.session);
      setUser(userResult.data.user ?? null);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setUser(null);
        setLoading(false);
        return;
      }
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user ?? nextSession.user);
        setLoading(false);
      }).catch(() => {
        setUser(nextSession.user);
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    signIn: async (email, password) => {
      if (!supabase) return;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setSession(data.session);
      setUser(data.user);
    },
    signUp: async (email, password, fullName) => {
      if (!supabase) return { needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
        },
      });
      if (error) throw error;
      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
      }
      return { needsConfirmation: !data.session };
    },
    resendConfirmation: async (email) => {
      if (!supabase) return;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=1` },
      });
      if (error) throw error;
    },
    resetPassword: async (email) => {
      if (!supabase) return;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=1`,
      });
      if (error) throw error;
    },
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
