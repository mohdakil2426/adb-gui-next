import { Skeleton } from '@/shared/ui/skeleton';

const LINES = [0, 1, 2];

/**
 * Occupies the slots the detail response will fill.
 *
 * The previous version rendered two skeleton bars *underneath* an already-real
 * hero, which described nothing that was actually loading.
 */
export function AppDetailSkeleton() {
  return (
    <output aria-label="Loading app details" className="grid @2xl:grid-cols-[1fr_280px] gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        {LINES.map((line) => (
          <Skeleton className="h-3 w-full" key={line} />
        ))}
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </output>
  );
}
