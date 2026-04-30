import { Skeleton } from "@/components/ui/skeleton";

export function CheckoutCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
      <div className="mb-6 flex flex-col items-center">
        <Skeleton className="mb-3 h-14 w-14 rounded-full" />
        <Skeleton className="h-3 w-32 rounded-md" />
      </div>

      <div className="mb-6 flex flex-col items-center gap-2">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="h-3 w-36 rounded-md" />
      </div>

      <div className="mb-6 flex justify-center">
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      <Skeleton className="mb-4 h-10 w-full rounded-md" />
      <Skeleton className="mx-auto mb-4 h-3 w-56 rounded-md" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
