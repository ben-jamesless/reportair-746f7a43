import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { FileText, LayoutGrid, MoreHorizontal, FileDown, Activity, Info, Settings as SettingsIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import type { ProjectStatus } from "@/lib/projectStatus";

type ProjectView = "report" | "gallery";

interface MobileProjectToolbarProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    event_date: string | null;
    event_location: string | null;
    overall_status: ProjectStatus | null;
    event_type: string | null;
    client_name: string | null;
    default_view: ProjectView | null;
  };
  photosCount: number;
  mostRecentDayLabel: string | null;
  effectiveView: ProjectView;
  setViewOverride: (v: ProjectView) => void;
  uploader: React.ReactNode;
  canEdit?: boolean;
  onOpenExport: () => void;
  onOpenActivity: () => void;
  onOpenDetails: () => void;
  onOpenFeedback: () => void;
  onLoadAll: () => void;
}

export const MobileProjectToolbar = ({
  project,
  photosCount,
  mostRecentDayLabel,
  effectiveView,
  setViewOverride,
  uploader,
  canEdit = true,
  onOpenExport,
  onOpenActivity,
  onOpenDetails,
  onOpenFeedback,
  onLoadAll,
}: MobileProjectToolbarProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const close = () => setSheetOpen(false);
  /** Close the bottom sheet, wait for its exit animation + Radix cleanup, then run the action.
   *  Without the delay Radix leaves `pointer-events: none` on <body> when one overlay closes
   *  and another opens in the same tick, locking the page. */
  const runAfterClose = (fn: () => void) => {
    setSheetOpen(false);
    setTimeout(fn, 220);
  };

  return (
    <div className="mb-4 md:hidden">

      <div className="flex items-center gap-2">
        {/* Report / Gallery toggle */}
        <div
          className="inline-flex shrink-0 rounded-md border bg-background p-0.5"
          role="radiogroup"
          aria-label="Project view"
        >
          <button
            type="button"
            role="radio"
            aria-checked={effectiveView === "report"}
            onClick={() => setViewOverride("report")}
            aria-label="Report view"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
              effectiveView === "report"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={effectiveView === "gallery"}
            onClick={() => setViewOverride("gallery")}
            aria-label="Gallery view"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
              effectiveView === "gallery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Upload — flex-1 centre (hidden for viewers) */}
        {canEdit ? (
          <div className="flex flex-1 justify-center [&_button]:h-9 [&_button]:w-full [&_button]:max-w-[200px]">
            {uploader}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Overflow */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle>{project.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-1">
              <Button
                variant="ghost"
                className="h-12 justify-start text-base"
                disabled={photosCount === 0}
                onClick={() => runAfterClose(onOpenExport)}
              >
                <FileDown className="mr-3 h-4 w-4" />
                Export {mostRecentDayLabel ? "latest day" : "project"}
              </Button>
              <Button
                variant="ghost"
                className="h-12 justify-start text-base"
                onClick={() => runAfterClose(() => setSettingsOpen(true))}
              >
                <SettingsIcon className="mr-3 h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="ghost"
                className="h-12 justify-start text-base"
                onClick={() => runAfterClose(onOpenFeedback)}
              >
                <MessageSquare className="mr-3 h-4 w-4" />
                Feedback
              </Button>
              <Button
                variant="ghost"
                className="h-12 justify-start text-base"
                onClick={() => runAfterClose(onOpenActivity)}
              >
                <Activity className="mr-3 h-4 w-4" />
                Activity
              </Button>
              <Button
                variant="ghost"
                className="h-12 justify-start text-base"
                onClick={() => runAfterClose(onOpenDetails)}
              >
                <Info className="mr-3 h-4 w-4" />
                Details
              </Button>
            </div>
            <SheetClose className="sr-only">Close</SheetClose>
          </SheetContent>
        </Sheet>

        {/* Hidden controlled settings dialog (reused trigger) */}
        <ProjectSettingsDialog
          projectId={project.id}
          project={project}
          onChanged={onLoadAll}
          trigger={null}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </div>
    </div>
  );
};
