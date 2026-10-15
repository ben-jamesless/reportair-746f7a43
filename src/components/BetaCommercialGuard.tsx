import { Navigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";

export function BetaCommercialGuard({ children }: { children: React.ReactNode }) {
  const { plan, loading } = usePlan();
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (plan === "beta") return <Navigate to="/projects" replace />;
  return <>{children}</>;
}