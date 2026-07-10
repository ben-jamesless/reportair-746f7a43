import { RichNotes } from "@/components/RichNotes";
import { cn } from "@/lib/utils";

/**
 * Shared renderer for day-field text (today's objectives, achievements,
 * tomorrow's objectives, open issues, area notes). Used by both the Daily
 * Report and Overview so bullet/heading rendering can't drift between them.
 *
 * - Filled value → real markdown-ish rendering via RichNotes (bullets, bold,
 *   headings). Never literal "*" or "-".
 * - Empty value → italic muted placeholder (or nothing, if placeholder omitted).
 */
export function DayFieldContent({
  value,
  placeholder,
  className,
}: {
  value: string | null | undefined;
  placeholder?: string;
  className?: string;
}) {
  const hasValue = !!value && value.trim().length > 0;
  if (hasValue) {
    return <RichNotes value={value!} className={cn("text-foreground", className)} />;
  }
  if (!placeholder) return null;
  return (
    <span className={cn("italic text-muted-foreground text-sm", className)}>
      {placeholder}
    </span>
  );
}
