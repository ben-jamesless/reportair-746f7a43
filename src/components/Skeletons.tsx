import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader } from "@/components/ui/card";

/** Grid of project card skeletons matching the Projects page layout. */
export const ProjectGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="h-full">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-2/3" />
        </CardHeader>
      </Card>
    ))}
  </div>
);

/** Responsive grid of square photo thumb skeletons. */
export const PhotoGridSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="aspect-square w-full rounded-md" />
    ))}
  </div>
);

/** Sidebar nav skeleton (day rows) used while ProjectDetail loads. */
export const DayNavSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-2 rounded-md px-2 py-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-6" />
      </div>
    ))}
  </div>
);

/** Activity feed list skeleton. */
export const ActivityFeedSkeleton = ({ count = 5 }: { count?: number }) => (
  <ul className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <li key={i} className="flex items-start gap-3 rounded-md border bg-card p-3">
        <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </li>
    ))}
  </ul>
);
