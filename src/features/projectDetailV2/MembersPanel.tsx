import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InvitesManager } from "@/components/InvitesManager";

/**
 * Phase 4 (part 3) — Members entry point in v2.
 *
 * Thin surface wrapper around the existing InvitesManager. No new invite
 * or role logic lives here; this only gives owners/editors a v2-native
 * way to manage project members without falling back to the classic view.
 *
 * Visual system mirrors SharePanel: square, hairline border, no shadow,
 * dashed 1px dividers on a paper-toned sheet.
 */

const LABEL_INK = "#5C5850";

export function MembersPanel({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Members</SheetTitle>
          <SheetDescription>
            Invite teammates, change roles, and remove access. Internal team
            only — client sharing lives in Share &amp; deliver.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block shrink-0 rounded-full"
              style={{ width: 9, height: 9, backgroundColor: "#3A6EA5" }}
            />
            <span
              className="font-semibold uppercase"
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                color: LABEL_INK,
              }}
            >
              Project access
            </span>
          </div>
          <InvitesManager projectId={projectId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
