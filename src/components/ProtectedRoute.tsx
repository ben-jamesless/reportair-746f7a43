import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const signedOutRef = useRef(false);
  useSessionTimeout(!!user && !profile?.suspended_at);

  // Suspended users get force-signed-out; the render below handles the redirect.
  useEffect(() => {
    if (profile?.suspended_at && !signedOutRef.current) {
      signedOutRef.current = true;
      void signOut();
    }
  }, [profile?.suspended_at, signOut]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (profile?.suspended_at) {
    return <Navigate to="/auth?error=suspended" replace />;
  }

  // Force onboarding for any signed-in user who hasn't finished it, except on
  // the onboarding flow itself and the public invite-accept page.
  const path = location.pathname;
  const isOnboardingFlow = path.startsWith("/onboarding") || path.startsWith("/invite/");
  if (profile && !profile.onboarded_at && !isOnboardingFlow) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
