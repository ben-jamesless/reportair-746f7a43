import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MessageSquare, X } from "lucide-react";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { type LightboxPhoto } from "@/components/PhotoLightbox";

type FeedbackSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  visiblePhotos: LightboxPhoto[];
  allPhotos: LightboxPhoto[];
  onOpenPhoto: (photoId: string) => void;
};

// Right-side feedback panel. All breakpoints — slides in over content.
// Pure presentational wrapper; the consumer handles deep-linking to photos
// (resetting filters / setting lightbox index) via onOpenPhoto.
export function FeedbackSheet({
  open,
  onOpenChange,
  projectId,
  visiblePhotos,
  allPhotos,
  onOpenPhoto,
}: FeedbackSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full sm:w-[400px] flex-col p-0 [&>button]:hidden">
        {/* Panel header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#D94F2A]" />
            <span className="text-sm font-semibold text-foreground">Feedback</span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Panel body */}
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <FeedbackPanel
            projectId={projectId}
            visiblePhotos={visiblePhotos}
            allPhotos={allPhotos}
            onOpenPhoto={onOpenPhoto}
            className="h-full"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
