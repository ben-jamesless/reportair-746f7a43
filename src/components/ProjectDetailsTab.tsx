import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PROJECT_STATUSES,
  projectStatusMeta,
  type ProjectStatus,
} from "@/lib/projectStatus";

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
  onChanged: () => void;
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
const toIsoDate = (d: Date | undefined): string | null => {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const updateField = async (
  projectId: string,
  patch: Record<string, unknown>,
): Promise<boolean> => {
  const { error } = await supabase
    .from("projects")
    .update(patch as never)
    .eq("id", projectId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  return true;
};

/* ------------------------------ Inline editors ----------------------------- */

const InlineText = ({
  value,
  placeholder,
  multiline,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  onSave: (next: string | null) => Promise<boolean>;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={2}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder={placeholder}
          className="text-sm"
        />
      );
    }
    return (
      <Input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    );
  }

  const has = !!value && value.trim().length > 0;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-border hover:bg-secondary/40",
        !has && "text-muted-foreground italic",
      )}
      title="Click to edit"
    >
      <span className="flex-1 truncate">{has ? value : placeholder}</span>
      <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </button>
  );
};

const InlineDate = ({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => Promise<boolean>;
}) => {
  const [open, setOpen] = useState(false);
  const date = fromIsoDate(value);
  const has = !!date;
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex flex-1 items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-border hover:bg-secondary/40",
              !has && "text-muted-foreground italic",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
            <span className="flex-1">
              {has ? META_DATE_FMT.format(date!) : "Pick a date"}
            </span>
            <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={async (d) => {
              setOpen(false);
              const next = toIsoDate(d ?? undefined);
              if (next === (value ?? null)) return;
              await onSave(next);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {has && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Clear date"
          onClick={() => onSave(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

const InlineStatus = ({
  value,
  onSave,
}: {
  value: ProjectStatus | null;
  onSave: (next: ProjectStatus) => Promise<boolean>;
}) => {
  const current = value ?? "no_status";
  const meta = projectStatusMeta(current);
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v === current) return;
        onSave(v as ProjectStatus);
      }}
    >
      <SelectTrigger className="h-9 border-transparent bg-transparent text-sm hover:border-border hover:bg-secondary/40 focus:border-border">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
            {meta.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
              {s.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/* --------------------------------- Field row ------------------------------- */

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 gap-1 border-b border-border/60 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
      {label}
    </dt>
    <dd>{children}</dd>
  </div>
);

/* ---------------------------------- Tab ----------------------------------- */

export const ProjectDetailsTab = ({ project, lastUploadAt, onChanged }: Props) => {
  const save = async (patch: Record<string, unknown>) => {
    const ok = await updateField(project.id, patch);
    if (ok) onChanged();
    return ok;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <dl className="rounded-lg border bg-card px-4 sm:px-6">
        <Row label="Name">
          <InlineText
            value={project.name}
            placeholder="Project name"
            onSave={async (next) => {
              if (!next) {
                toast.error("Name is required");
                return false;
              }
              return save({ name: next });
            }}
          />
        </Row>
        <Row label="Description">
          <InlineText
            value={project.description}
            placeholder="Add a description"
            multiline
            onSave={(next) => save({ description: next })}
          />
        </Row>
        <Row label="Client">
          <InlineText
            value={project.client_name}
            placeholder="Add a client"
            onSave={(next) => save({ client_name: next })}
          />
        </Row>
        <Row label="Event date">
          <InlineDate
            value={project.event_date}
            onSave={(next) => save({ event_date: next })}
          />
        </Row>
        <Row label="Event location">
          <InlineText
            value={project.event_location}
            placeholder="Add a location"
            onSave={(next) => save({ event_location: next })}
          />
        </Row>
        <Row label="Event type">
          <InlineText
            value={project.event_type}
            placeholder="e.g. Conference, Wedding"
            onSave={(next) => save({ event_type: next })}
          />
        </Row>
        <Row label="Overall status">
          <InlineStatus
            value={project.overall_status}
            onSave={(next) => save({ overall_status: next })}
          />
        </Row>
        <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            Last upload
          </dt>
          <dd className="px-2 py-1.5 text-sm text-muted-foreground">
            {lastUploadAt ? REL_FMT.format(new Date(lastUploadAt)) : "No uploads yet"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 px-1 text-xs text-muted-foreground">
        Click any field to edit. Press Enter to save, Escape to cancel.
      </p>
    </div>
  );
};
