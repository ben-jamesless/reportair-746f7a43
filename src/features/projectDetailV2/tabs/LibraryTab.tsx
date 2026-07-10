import { PlaceholderTab } from "./PlaceholderTab";

export function LibraryTab({ projectId }: { projectId: string }) {
  return (
    <PlaceholderTab
      projectId={projectId}
      title="Library"
      description="Every photo on the project — filter by zone, day, or status. Destructive delete lives here. Lands in Phase 2."
    />
  );
}
