import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
  /** Front frame colour. Defaults to SKY. */
  front?: string;
  /** Back (ghost) frame colour. Defaults to SKY_SOFT. */
  back?: string;
  variant?: "light" | "dark" | "onSky";
}

/** ReportAir mark: two overlapping rounded rectangles. */
export const ReportAirMark = ({ className, front, back, variant = "light" }: MarkProps) => {
  const colors =
    variant === "dark"
      ? { front: "#1A6EFF", back: "#3A5A9A" }
      : variant === "onSky"
        ? { front: "#FFFFFF", back: "#FFFFFF" }
        : { front: "#1A6EFF", back: "#A8C4FF" };
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      aria-hidden="true"
    >
      <rect
        x="11"
        y="19"
        width="60"
        height="50"
        rx="6"
        stroke={back ?? colors.back}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="27"
        y="35"
        width="60"
        height="50"
        rx="6"
        stroke={front ?? colors.front}
        strokeWidth="6.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface LockupProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  variant?: "light" | "dark" | "onSky";
}

/** Mark + REPORTAIR wordmark lockup. */
export const ReportAirLockup = ({ className, markClassName, textClassName, variant = "light" }: LockupProps) => {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ReportAirMark variant={variant} className={cn("h-7 w-7", markClassName)} />
      <span
        className={cn(
          "wordmark text-base",
          variant === "dark" || variant === "onSky" ? "text-white" : "text-foreground",
          textClassName,
        )}
      >
        REPORTAIR
      </span>
    </span>
  );
};
