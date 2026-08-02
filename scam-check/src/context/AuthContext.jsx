import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchUsage } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!session) {
      setUsage(null);
      return null;
    }
    try {
      const next = await fetchUsage();
      setUsage(next);
      return next;
    } catch {
      // A missing usage figure shouldn't break the page; the edge function is
      // the authority on the limit anyway.
      return null;
    }
  }, [session]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUsage(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      usage,
      setUsage,
      refreshUsage,
      signOut,
    }),
    [session, loading, usage, refreshUsage, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
