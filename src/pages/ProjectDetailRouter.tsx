import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ProjectShellV2 = lazy(() => import("@/features/projectDetailV2/ProjectShellV2"));

export default function ProjectDetailRouter() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-64" /></div>}>
      <ProjectShellV2 />
    </Suspense>
  );
}
