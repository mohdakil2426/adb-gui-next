import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';

const CARDS = [0, 1, 2, 3, 4, 5];

/**
 * Placeholder results.
 *
 * Searching used to blank the list and centre a full-page spinner, so every
 * keystroke-triggered refetch erased what the user was reading. Prior results
 * now stay on screen and only a first search reaches this.
 */
export function ResultsSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <output
      aria-label="Loading search results"
      className={cn(
        viewMode === 'grid'
          ? 'grid @4xl:grid-cols-3 @7xl:grid-cols-4 @lg:grid-cols-2 gap-3'
          : 'flex flex-col gap-2',
      )}
    >
      {CARDS.map((card) => (
        <div
          className={cn(
            'flex gap-3 rounded-lg border border-border bg-surface p-3',
            viewMode === 'grid' ? 'flex-col' : 'items-center',
          )}
          key={card}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </output>
  );
}
