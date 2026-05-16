import { useState } from "react";
import { CalendarDays, Download, MapPin, Trash2, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Area } from "@/lib/projectDetailTypes";

type DayOption = { key: string; label: string };

type Props = {
  // Visibility — render the floating bar only when both are true
  visible: boolean;
  selectedCount: number;

  // Data
  areas: Area[];
  days: DayOption[];

  // Capability + in-flight flags from the data hook
  canEdit: boolean;
  downloading: boolean;
  deleting: boolean;

  // Callbacks (already bound by parent to the selected ids)
  onAssignArea: (areaId: string | null) => void;
  onMoveToDay: (dayKey: string) => void;
  onDownload: () => void;
  onDelete: () => Promise<void> | void;
  onExitSelectMode: () => void;
};

export function SelectionToolbar({
  visible,
  selectedCount,
  areas,
  days,
  canEdit,
  downloading,
  deleting,
  onAssignArea,
  onMoveToDay,
  onDownload,
  onDelete,
  onExitSelectMode,
}: Props) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <>
      {visible && selectedCount > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg"
          role="toolbar"
          aria-label="Bulk photo actions"
        >
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canEdit && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary" className="bg-card/15 text-white hover:bg-card/25 border-0">
                    <MapPin className="mr-1.5 h-4 w-4" />
                    Reassign area
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <button
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => onAssignArea(null)}
                  >
                    Unassigned
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <div className="max-h-64 overflow-y-auto">
                    {areas.map((ar) => (
                      <button
                        key={ar.id}
                        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => onAssignArea(ar.id)}
                      >
                        {ar.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {canEdit && days.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary" className="bg-card/15 text-white hover:bg-card/25 border-0">
                    <CalendarDays className="mr-1.5 h-4 w-4" />
                    Move to day
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1" align="end">
                  <div className="max-h-64 overflow-y-auto">
                    {days.map((d) => (
                      <button
                        key={d.key}
                        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => onMoveToDay(d.key)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="bg-card/15 text-white hover:bg-card/25 border-0"
              onClick={onDownload}
              disabled={downloading}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {downloading ? "Zipping…" : "Download"}
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-card/15 text-white hover:bg-card/25 border-0"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-card/15 hover:text-white"
              onClick={onExitSelectMode}
              aria-label="Exit selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={(o) => !deleting && setConfirmDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected photos and remove them from the project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await onDelete();
                setConfirmDeleteOpen(false);
              }}
              disabled={deleting}
              className={buttonVariants({ variant: "destructive" })}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
