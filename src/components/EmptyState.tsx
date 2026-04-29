import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Consistent empty-state card used across zero-content views.
 */
export const EmptyState = ({ icon, title, description, action, className, size = "md" }: Props) => (
  <Card className={cn("border-dashed shadow-none", className)}>
    <CardContent
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        size === "sm" ? "py-8" : "py-14 sm:py-16",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 text-primary",
          size === "sm" ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className={cn("font-semibold", size === "sm" ? "text-sm" : "text-base sm:text-lg")}>
          {title}
        </h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </CardContent>
  </Card>
);
