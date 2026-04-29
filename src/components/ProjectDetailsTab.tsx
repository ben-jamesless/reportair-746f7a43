import { projectStatusMeta, type ProjectStatus } from "@/lib/projectStatus";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
};

interface Props {
  project: Project;
  lastUploadAt: string | null;
}

const META_DATE_FMT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const REL_FMT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const fromIsoDate = (s: string | null): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 gap-1 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
      {label}
    </dt>
    <dd className="px-1 text-sm">{children}</dd>
  </div>
);

const Empty = () => <span className="italic text-muted-foreground">—</span>;

export const ProjectDetailsTab = ({ project, lastUploadAt }: Props) => {
  const statusMeta = projectStatusMeta(project.overall_status);
  const showStatus = (project.overall_status ?? "no_status") !== "no_status";
  const eventDate = fromIsoDate(project.event_date);

  return (
    <div className="mx-auto max-w-3xl">
      <dl className="rounded-lg border bg-card px-4 sm:px-6">
        <Row label="Name">{project.name}</Row>
        {project.description && <Row label="Description">{project.description}</Row>}
        <Row label="Client">{project.client_name || <Empty />}</Row>
        <Row label="Event date">
          {eventDate ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
              {META_DATE_FMT.format(eventDate)}
            </span>
          ) : (
            <Empty />
          )}
        </Row>
        <Row label="Event location">{project.event_location || <Empty />}</Row>
        <Row label="Event type">{project.event_type || <Empty />}</Row>
        <Row label="Overall status">
          {showStatus ? (
            <span className="inline-flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", statusMeta.dotClass)} />
              {statusMeta.label}
            </span>
          ) : (
            <Empty />
          )}
        </Row>
        <Row label="Last upload">
          <span className="text-muted-foreground">
            {lastUploadAt ? REL_FMT.format(new Date(lastUploadAt)) : "No uploads yet"}
          </span>
        </Row>
      </dl>
      <p className="mt-3 px-1 text-xs text-muted-foreground">
        To edit any of these fields, open <span className="font-medium">Settings</span>.
      </p>
    </div>
  );
};
