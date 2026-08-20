import { Clock3, Compass, SearchX, Settings2 } from 'lucide-react';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { AppCard } from './AppCard';

/**
 * Starting points, not "collections".
 *
 * These were previously presented as curated collections while being plain
 * search strings — clicking "Privacy" ran a text search for the word "Privacy"
 * and returned whatever happened to match. They are now labelled as what they
 * are: suggested searches.
 */
const SUGGESTED_SEARCHES = [
  'password manager',
  'file manager',
  'media player',
  'browser',
  'keyboard',
  'launcher',
] as const;

const RECENT_SEARCH_LIMIT = 6;
const RECENT_APP_LIMIT = 3;

interface MarketplaceEmptyStateProps {
  hasQuery: boolean;
  onQuickSearch: (query: string) => void;
  target: InstallTarget;
}

function ChipRow({
  entries,
  onSelect,
}: {
  entries: readonly string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((entry) => (
        <Button
          className="rounded-full"
          key={entry}
          onClick={() => {
            onSelect(entry);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {entry}
        </Button>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-caption text-muted-foreground uppercase tracking-wide">{children}</h3>;
}

export function MarketplaceEmptyState({
  hasQuery,
  onQuickSearch,
  target,
}: MarketplaceEmptyStateProps) {
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const recentlyViewedApps = useMarketplaceStore((state) => state.recentlyViewedApps);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
  const lastSearch = useMarketplaceStore((state) => state.lastSearch);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const openSettings = useMarketplaceStore((state) => state.openSettings);

  if (hasQuery) {
    return (
      <Empty className="border border-border border-dashed bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No apps matched that search</EmptyTitle>
          <EmptyDescription>
            Try a shorter term, enable more sources in Settings, or search by exact package name
            (for example <span className="font-mono text-mono">org.mozilla.firefox</span>).
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openSettings} size="sm" type="button" variant="outline">
            <Settings2 aria-hidden="true" data-icon="inline-start" />
            Open source settings
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Empty className="border border-border border-dashed bg-surface py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Search for an app</EmptyTitle>
          <EmptyDescription>
            {target.canInstall
              ? 'Results come from your enabled sources and install straight to the selected device.'
              : 'Browsing and search work without a device — connect one when you are ready to install.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-xl gap-3">
          {lastSearch?.query ? (
            <Button
              onClick={() => {
                onQuickSearch(lastSearch.query);
              }}
              size="sm"
              type="button"
            >
              Resume “{lastSearch.query}”
            </Button>
          ) : null}
          <SectionHeading>Suggested searches</SectionHeading>
          <ChipRow entries={SUGGESTED_SEARCHES} onSelect={onQuickSearch} />
        </EmptyContent>
      </Empty>

      {(searchHistory ?? []).length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading>Recent searches</SectionHeading>
          <ChipRow
            entries={(searchHistory ?? []).slice(0, RECENT_SEARCH_LIMIT)}
            onSelect={onQuickSearch}
          />
        </section>
      ) : null}

      {(recentlyViewedApps ?? []).length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading>Recently viewed</SectionHeading>
          <div className="grid @4xl:grid-cols-3 @lg:grid-cols-2 gap-3">
            {(recentlyViewedApps ?? []).slice(0, RECENT_APP_LIMIT).map((app) => (
              <AppCard
                app={app}
                key={`${app.source}-${app.packageName}`}
                onSelect={openDetail}
                target={target}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
        {githubSession.user
          ? `Signed in to GitHub as ${githubSession.user.login}.`
          : 'Anonymous browsing is the default.'}{' '}
        <button
          className="cursor-pointer text-primary underline underline-offset-2"
          onClick={openSettings}
          type="button"
        >
          {githubSession.user ? 'Manage session' : 'Sign in to raise GitHub rate limits'}
        </button>
      </p>
    </div>
  );
}
