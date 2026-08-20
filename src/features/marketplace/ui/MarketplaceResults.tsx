import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { AppCard } from '@/features/marketplace/ui/AppCard';
import { AppListItem } from '@/features/marketplace/ui/AppListItem';
import { ResultsSkeleton } from '@/features/marketplace/ui/ResultsSkeleton';

// Empty state handled across UI when data?.length === 0

type MarketplaceApp = backend.MarketplaceApp;

function MarketplaceResults({
  fromCache,
  isSearching,
  onSelect,
  rawCount,
  results,
  target,
  viewMode,
}: {
  fromCache: boolean;
  isSearching: boolean;
  onSelect: (app: MarketplaceApp) => void;
  rawCount: number;
  results: MarketplaceApp[];
  target: InstallTarget;
  viewMode: 'grid' | 'list';
}) {
  const safeResults = results ?? [];
  const filtered = safeResults.length !== rawCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-caption text-muted-foreground uppercase tracking-wide">Results</h2>
        <span className="numeric text-caption text-muted-foreground">
          {isSearching && fromCache
            ? 'Refreshing cache…'
            : isSearching
              ? 'Updating…'
              : filtered
                ? `${safeResults.length} of ${rawCount} apps`
                : `${safeResults.length} apps`}
        </span>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid @4xl:grid-cols-3 @7xl:grid-cols-4 @lg:grid-cols-2 gap-3">
          {safeResults.map((app) => (
            <AppCard
              app={app}
              key={`${app.source}-${app.packageName}`}
              onSelect={onSelect}
              target={target}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {safeResults.map((app) => (
            <AppListItem
              app={app}
              key={`${app.source}-${app.packageName}`}
              onSelect={onSelect}
              target={target}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketplaceResultsBody({
  fromCache,
  hasResults,
  isSearching,
  onSelect,
  rawCount,
  results,
  showSkeleton,
  target,
  viewMode,
}: {
  fromCache: boolean;
  hasResults: boolean;
  isSearching: boolean;
  onSelect: (app: MarketplaceApp) => void;
  rawCount: number;
  results: MarketplaceApp[];
  showSkeleton: boolean;
  target: InstallTarget;
  viewMode: 'grid' | 'list';
}) {
  return (
    <>
      {showSkeleton ? <ResultsSkeleton viewMode={viewMode} /> : null}
      {hasResults ? (
        <MarketplaceResults
          fromCache={fromCache}
          isSearching={isSearching}
          onSelect={onSelect}
          rawCount={rawCount}
          results={results}
          target={target}
          viewMode={viewMode}
        />
      ) : null}
    </>
  );
}
