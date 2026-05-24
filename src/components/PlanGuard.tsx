import { Navigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { Loader2 } from "lucide-react";

interface Props {
  allow: string[];
  children: React.ReactNode;
}

/**
 * Restrict a route to users whose plan is in `allow`.
 * Other plans get redirected to /billing.
 */
export const PlanGuard = ({ allow, children }: Props) => {
  const { plan, loading } = usePlan();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allow.includes(plan)) {
    return <Navigate to="/billing" replace />;
  }

  return <>{children}</>;
};
