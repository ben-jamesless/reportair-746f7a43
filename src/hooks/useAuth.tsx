import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSignedUrlCache } from "@/hooks/useSignedUrl";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (event === "SIGNED_IN" && newSession?.user) {
        // Defer Supabase calls to avoid deadlocks inside the auth callback
        setTimeout(async () => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarded_at")
            .eq("id", newSession.user.id)
            .maybeSingle();
          if (!profile?.onboarded_at) {
            const path = window.location.pathname;
            if (!path.startsWith("/onboarding") && !path.startsWith("/invite/")) {
              window.location.replace("/onboarding");
            }
          }
        }, 0);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    clearSignedUrlCache();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
