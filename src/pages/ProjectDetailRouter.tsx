import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useBetaUi } from "@/hooks/useBetaUi";
import { Skeleton } from "@/components/ui/skeleton";

const ClassicProjectDetail = lazy(() => import("./ProjectDetail"));
const ProjectShellV2 = lazy(() => import("@/features/projectDetailV2/ProjectShellV2"));

/**
 * Branches `/projects/:id` on `profiles.beta_ui`. `?classic=1` forces the
 * classic shell without flipping the flag, so beta users can always escape.
 */
export default function ProjectDetailRouter() {
  const { betaUi, loading } = useBetaUi();
  const [searchParams] = useSearchParams();
  const forceClassic = searchParams.get("classic") === "1";

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  const useV2 = betaUi && !forceClassic;

  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-64" /></div>}>
      {useV2 ? <ProjectShellV2 /> : <ClassicProjectDetail />}
    </Suspense>
  );
}
