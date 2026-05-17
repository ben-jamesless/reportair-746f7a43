import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
  /** Kept for backward compat — no effect on BuildSlides mark. */
  front?: string;
  back?: string;
  /** "dark" / "onSky" kept for compat with existing call sites. */
  variant?: "light" | "dark" | "onSky";
}

/** BuildSlides mark: orange rounded tile with two stacked slide rectangles. */
export const BuildSlidesMark = ({ className }: MarkProps) => {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      role="img"
      aria-label="BuildSlides"
    >
      <rect x="0" y="0" width="32" height="32" rx="7" fill="#D94F2A" />
      <rect x="7" y="9.5" width="14" height="9" rx="1.6" fill="#FFFFFF" opacity="0.55" />
      <rect x="11" y="13.5" width="14" height="9" rx="1.6" fill="#FFFFFF" />
    </svg>
  );
};

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
export const BuildSlidesMark = BuildSlidesMark;
export const BuildSlidesLockup = BuildSlidesLockup;
