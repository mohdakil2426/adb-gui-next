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
      <div className="flex items-center gap-2 font-medium text-body">
        <RefreshCw className="size-4 text-muted-foreground" />
        Cache and history
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onClearCache} type="button" variant="outline">
          <RefreshCw />
          Clear cache
        </Button>
        <Button
          disabled={searchHistoryCount === 0}
          onClick={onClearSearchHistory}
          type="button"
          variant="outline"
        >
          <Trash2 />
          Clear search history
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        {searchHistoryCount > 0
          ? `${searchHistoryCount} recent search${searchHistoryCount === 1 ? '' : 'es'} saved locally.`
          : 'No local search history saved yet.'}
      </p>
    </section>
  );
}
