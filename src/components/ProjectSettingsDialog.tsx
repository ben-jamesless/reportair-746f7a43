import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2 } from "lucide-react";
import { AreasManager } from "./AreasManager";
import { AlbumsManager } from "./AlbumsManager";
import { ProjectEditForm } from "./ProjectEditForm";
import { HeicBackfillButton } from "./HeicBackfillButton";
import { BulkSetCaptureDateCard } from "./BulkSetCaptureDateCard";
import { CoverPhotoManager } from "./CoverPhotoManager";
import { EventPhasesEditor } from "./EventPhasesEditor";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectStatus } from "@/lib/projectStatus";
import { useProjectPlan } from "@/hooks/useProjectPlan";
import {
  PanelBar,
  SectionLabel,
  SegmentedTabs,
  MONO,
  T,
  inkButtonClass,
  quietButtonClass,
} from "@/features/projectSettings/settingsUi";
import { formatAbsoluteStamp } from "@/lib/eventTime";
import { useProjectTimeZone } from "@/hooks/useProjectTimeZone";

interface ProjectForEdit {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  event_date: string | null;
  build_start_date?: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  default_view?: "report" | "gallery" | null;
}

type SettingsTab = "details" | "areas" | "albums" | "cover";

interface Props {
  projectId: string;
  /** Current project values — required so the Details tab can edit them. */
  project: ProjectForEdit;
  onChanged?: () => void;
  /** Optional default tab to open on. */
  defaultTab?: SettingsTab;
  /** Pass null to omit the built-in trigger (use controlled open instead). */
  trigger?: React.ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Project settings — four tabs only: Details, Areas, Albums, Cover photo.
 * Members and Share deliberately do NOT live here: the top-right Members and
 * Share & deliver panels are canonical, and duplicating them produced two
 * surfaces describing two different sharing products.
 */
export const ProjectSettingsDialog = ({ projectId, project, onChanged, defaultTab = "details", trigger, open: controlledOpen, onOpenChange }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  const [canManageAlbums, setCanManageAlbums] = useState(false);
  const { plan } = useProjectPlan(projectId);
  const isStudio = plan === "studio";
  const [tab, setTab] = useState<SettingsTab>(defaultTab);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveRef = useRef<(() => Promise<void>) | null>(null);
  const eventTz = useProjectTimeZone(projectId);

  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: pm }, { data: ar }] = await Promise.all([
        supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCanManageAlbums(pm?.role === "owner" || !!ar);
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  const tabs: { value: SettingsTab; label: string }[] = [
    { value: "details", label: "Details" },
    { value: "areas", label: "Areas" },
    ...(canManageAlbums ? [{ value: "albums" as const, label: "Albums" }] : []),
    ...(isStudio ? [{ value: "cover" as const, label: "Cover photo" }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="rounded-none">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        className="flex h-[85vh] max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-none p-0 shadow-none"
        style={{ backgroundColor: T.paper, borderColor: T.rule }}
      >
        <PanelBar title="Project settings" />
        <DialogTitle className="sr-only">Project settings</DialogTitle>
        <DialogDescription className="sr-only">
          Edit details, areas, albums and the cover photo for this project.
        </DialogDescription>

        <div className="px-4 pt-4">
          <SegmentedTabs
            value={tab}
            onValueChange={(v) => setTab(v as SettingsTab)}
            options={tabs}
          />
        </div>

        {/* The scroll container must never take a focus ring — Radix used to
            mark it focusable, which painted an outline that read as a
            validation error. */}
        <div
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        >
          {tab === "details" && (
            <ProjectEditForm
              projectId={projectId}
              name={project.name}
              description={project.description}
              color={project.color}
              event_date={project.event_date}
              build_start_date={project.build_start_date ?? null}
              event_location={project.event_location}
              overall_status={project.overall_status}
              event_type={project.event_type}
              client_name={project.client_name}
              default_view={project.default_view ?? "report"}
              onSaved={onChanged}
              onClose={() => setOpen(false)}
              hideFooter
              saveRef={saveRef}
              onBusyChange={setBusy}
              onSavedAt={setSavedAt}
              timelineSection={<EventPhasesEditor projectId={projectId} />}
              extraSections={
                <>
                  <HeicBackfillButton projectId={projectId} />
                  <BulkSetCaptureDateCard projectId={projectId} />
                </>
              }
              elsewhereSection={<ElsewhereBlock />}
            />
          )}
          {tab === "areas" && <AreasManager projectId={projectId} onChanged={onChanged} />}
          {tab === "albums" && canManageAlbums && <AlbumsManager projectId={projectId} onChanged={onChanged} />}
          {tab === "cover" && isStudio && <CoverPhotoManager projectId={projectId} />}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderTop: `1px solid ${T.rule}`, backgroundColor: T.paper2 }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: T.muted, textTransform: "uppercase" }}>
            {savedAt ? `Saved ${formatAbsoluteStamp(savedAt, eventTz)}` : "No changes saved yet"}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={quietButtonClass} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={inkButtonClass}
              disabled={busy || tab !== "details"}
              onClick={() => saveRef.current?.()}
              title={tab === "details" ? undefined : "Areas, albums and cover changes save as you make them"}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Points at the canonical surfaces so settings never grows a second copy. */
function ElsewhereBlock() {
  return (
    <section className="pt-2">
      <SectionLabel>Elsewhere</SectionLabel>
      <dl className="space-y-2 text-sm" style={{ color: T.ink2 }}>
        <div className="flex gap-2">
          <dt className="w-40 shrink-0" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, paddingTop: 3 }}>
            Share &amp; deliver
          </dt>
          <dd>Client link, password, view counts and Finalise event.</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-40 shrink-0" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, paddingTop: 3 }}>
            Members
          </dt>
          <dd>Teammates, roles and access.</dd>
        </div>
      </dl>
    </section>
  );
}
