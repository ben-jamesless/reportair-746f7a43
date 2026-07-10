import { PlaceholderTab } from "./PlaceholderTab";

export function DailyReportTab({ projectId }: { projectId: string }) {
  return (
    <PlaceholderTab
      projectId={projectId}
      title="Daily Report"
      description="Updates + Gallery merged into a single day-by-day surface with Objectives, Progress, Issues, and photos. Lands in Phase 1."
    />
  );
}
