import type { backend } from "@/desktop/models";
import type { InstallTarget } from "@/features/marketplace/model/install-target";
import { AppCard } from "@/features/marketplace/ui/app-card";
import { AppListItem } from "@/features/marketplace/ui/app-list-item";
import { ResultsSkeleton } from "@/features/marketplace/ui/results-skeleton";

// Empty state handled across UI when data?.length === 0

type MarketplaceApp = backend.MarketplaceApp;

const MarketplaceResults = ({
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
  viewMode: "grid" | "list";
}) => {
  const safeResults = results ?? [];
  const filtered = safeResults.length !== rawCount;
  const getStatusText = () => {
    if (isSearching && fromCache) {
      return "Refreshing cache…";
    }
    if (isSearching) {
      return "Updating…";
    }
    if (filtered) {
      return `${safeResults.length} of ${rawCount} apps`;
    }
    return `${safeResults.length} apps`;
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-caption text-muted-foreground uppercase tracking-wide">Results</h2>
        <span className="numeric text-caption text-muted-foreground">{getStatusText()}</span>
      </div>

      {viewMode === "grid" ? (
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
};

export const MarketplaceResultsBody = ({
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
  viewMode: "grid" | "list";
}) => (
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
