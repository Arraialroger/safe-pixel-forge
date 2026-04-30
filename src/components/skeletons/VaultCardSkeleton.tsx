import { Skeleton } from "@/components/ui/skeleton";

export function VaultCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <Skeleton className="mb-3 h-3 w-40 rounded-md" />
      <Skeleton className="mb-2 h-7 w-28 rounded-md" />
      <Skeleton className="mb-4 h-3 w-32 rounded-md" />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-10 rounded-md" />
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>
    </div>
  );
}
