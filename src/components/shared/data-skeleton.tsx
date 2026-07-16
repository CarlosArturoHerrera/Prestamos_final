import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header row */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-4 flex-1"
              style={{ maxWidth: i === 0 ? 80 : undefined }}
            />
          ))}
        </div>
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className={cn(
            "flex items-center gap-4 px-4 py-3",
            row < rows - 1 && "border-b border-border",
          )}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className="h-4 flex-1"
              style={{
                opacity: 1 - row * 0.08,
                maxWidth: col === cols - 1 ? 80 : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
