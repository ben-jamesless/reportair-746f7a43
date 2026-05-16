import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSignedUrlCache } from "@/hooks/useSignedUrl";

export type AuthProfile = {
  id: string;
  onboarded_at: string | null;
  suspended_at: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  /** True while we're resolving either the session or the initial profile fetch. */
  loading: boolean;
  /** Re-fetch the cached profile (e.g. after onboarding completes). */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, onboarded_at, suspended_at")
      .eq("id", userId)
      .maybeSingle();
    return (data ?? null) as AuthProfile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const next = await fetchProfile(uid);
    setProfile(next);
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    // Set up listener FIRST so we don't miss the initial event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionLoading(false);
      if (!newSession?.user) {
        setProfile(null);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setSessionLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile whenever the signed-in user changes. Runs outside the auth
  // callback to avoid the Supabase "deadlock inside onAuthStateChange" footgun.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchProfile(uid).then((p) => {
      if (cancelled) return;
      setProfile(p);
      setProfileLoading(false);
    });
    return () => { cancelled = true; };
  }, [session?.user?.id, fetchProfile]);

  const signOut = async () => {
    clearSignedUrlCache();
    await supabase.auth.signOut();
  };

  const loading = sessionLoading || (!!session?.user && profileLoading && !profile);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
