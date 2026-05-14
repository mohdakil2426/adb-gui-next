import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export function CacheHistorySection({
  onClearCache,
  onClearSearchHistory,
  searchHistoryCount,
}: {
  onClearCache: () => void;
  onClearSearchHistory: () => void;
  searchHistoryCount: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 font-medium text-sm">
        <RefreshCw className="size-4 text-muted-foreground" />
        Cache and history
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onClearCache} variant="outline">
          <RefreshCw data-icon="inline-start" />
          Clear cache
        </Button>
        <Button
          disabled={searchHistoryCount === 0}
          onClick={onClearSearchHistory}
          variant="outline"
        >
          <Trash2 data-icon="inline-start" />
          Clear search history
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {searchHistoryCount > 0
          ? `${searchHistoryCount} recent search${searchHistoryCount === 1 ? '' : 'es'} saved locally.`
          : 'No local search history saved yet.'}
      </p>
    </section>
  );
}
