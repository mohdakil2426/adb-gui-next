import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type ProviderSource = backend.ProviderSource;

const PROVIDERS: { id: ProviderSource; label: string; color: string }[] = [
  {
    id: 'F-Droid',
    label: 'F-Droid',
    color:
      'data-[active=true]:bg-sky-500/15 data-[active=true]:text-sky-700 dark:data-[active=true]:text-sky-400 data-[active=true]:border-sky-500/30',
  },
  {
    id: 'IzzyOnDroid',
    label: 'Izzy',
    color:
      'data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-700 dark:data-[active=true]:text-emerald-400 data-[active=true]:border-emerald-500/30',
  },
  {
    id: 'GitHub',
    label: 'GitHub',
    color:
      'data-[active=true]:bg-purple-500/15 data-[active=true]:text-purple-700 dark:data-[active=true]:text-purple-400 data-[active=true]:border-purple-500/30',
  },
  {
    id: 'Aptoide',
    label: 'Aptoide',
    color:
      'data-[active=true]:bg-orange-500/15 data-[active=true]:text-orange-700 dark:data-[active=true]:text-orange-400 data-[active=true]:border-orange-500/30',
  },
];

interface FilterBarProps {
  resultCount: number;
}

export function FilterBar({ resultCount }: FilterBarProps) {
  const { activeProviders, toggleProvider, setAllProviders, viewMode, setViewMode } =
    useMarketplaceStore();

  const allActive = activeProviders.length === PROVIDERS.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Provider filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 text-xs rounded-full px-3 transition-all',
            allActive && 'bg-accent text-accent-foreground border-accent',
          )}
          onClick={setAllProviders}
        >
          All
        </Button>
        {PROVIDERS.map((p) => {
          const isActive = activeProviders.includes(p.id);
          return (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              data-active={isActive}
              className={cn('h-7 text-xs rounded-full px-3 transition-all', p.color)}
              onClick={() => toggleProvider(p.id)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Result count */}
      {resultCount > 0 && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </span>
      )}

      {/* View toggle */}
      <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 w-6 p-0 rounded-sm', viewMode === 'grid' && 'bg-background shadow-sm')}
          onClick={() => setViewMode('grid')}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 w-6 p-0 rounded-sm', viewMode === 'list' && 'bg-background shadow-sm')}
          onClick={() => setViewMode('list')}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
