import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  placeholder?: string;
  onSave: (next: string | null) => Promise<void> | void;
  className?: string;
  rows?: number;
}

export const EditableNote = ({ value, placeholder = "Add a comment…", onSave, className, rows = 2 }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value ?? ""); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = async () => {
    setBusy(true);
    const trimmed = draft.trim();
    await onSave(trimmed === "" ? null : trimmed);
    setBusy(false);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("space-y-1.5", className)} onClick={(e) => e.stopPropagation()}>
        <Textarea
          ref={ref}
          rows={rows}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
        />
        <div className="flex gap-1">
          <Button size="sm" variant="default" className="h-7 px-2 text-xs" disabled={busy} onClick={commit}>
            <Check className="mr-1 h-3 w-3" /> Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={cancel}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  const hasValue = !!value && value.trim().length > 0;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn(
        "group flex w-full items-start gap-1.5 rounded-md border border-dashed border-transparent px-2 py-1 text-left text-xs transition-colors",
        hasValue ? "border-border/60 bg-background/40 hover:border-border" : "text-muted-foreground hover:border-border hover:bg-secondary/50",
        className,
      )}
      title="Click to edit comment"
    >
      <StickyNote className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
      <span className={cn("flex-1 whitespace-pre-wrap break-words", !hasValue && "italic")}>
        {hasValue ? value : placeholder}
      </span>
      <Pencil className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
};
