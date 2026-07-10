import { PlaceholderTab } from "./PlaceholderTab";

export function LibraryTab({ projectId }: { projectId: string }) {
  return (
    <PlaceholderTab
      projectId={projectId}
      title="Library"
      description="Every photo on the project — filter by area, day, or status. Destructive delete lives here. Lands in Phase 2."
    />
  );
}
