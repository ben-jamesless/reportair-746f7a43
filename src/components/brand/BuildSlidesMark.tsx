import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
  front?: string;
  back?: string;
  variant?: "light" | "dark" | "onSky";
}

/** BuildSlides mark: matches the marketing homepage favicon mark. */
export const BuildSlidesMark = ({ className }: MarkProps) => (
  <img
    src="/favicon.svg"
    className={cn("h-6 w-6", className)}
    alt="BuildSlides"
  />
);

interface LockupProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  variant?: "light" | "dark" | "onSky";
}

/** Mark + "BuildSlides" wordmark lockup. */
export const BuildSlidesLockup = ({ className, markClassName, textClassName, variant = "light" }: LockupProps) => {
  const onDark = variant === "dark" || variant === "onSky";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BuildSlidesMark className={cn("h-7 w-7", markClassName)} />
      <span
        className={cn(
          "wordmark text-base",
          onDark ? "text-[#F4F1EA]" : "text-[hsl(var(--heading))]",
          textClassName,
        )}
      >
        BuildSlides
      </span>
    </span>
  );
};

// Backward-compat aliases — existing imports keep working.
export const ReportAirMark = BuildSlidesMark;
export const ReportAirLockup = BuildSlidesLockup;
