import { PlaceholderTab } from "./PlaceholderTab";

export function OverviewTab({ projectId }: { projectId: string }) {
  return (
    <PlaceholderTab
      projectId={projectId}
      title="Overview"
      description="A project-at-a-glance surface — health, latest activity, quick jump to today's Daily Report. Lands in Phase 1."
    />
  );
}
