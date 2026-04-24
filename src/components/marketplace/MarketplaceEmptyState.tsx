import { Clock3, Compass, Loader2, Search, Sparkles, TrendingUp, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { useMarketplaceHome } from '@/lib/marketplace/useMarketplaceHome';
import { AppCard } from './AppCard';

const COLLECTIONS = ['Privacy', 'Media', 'Developer Tools', 'File Tools', 'Messaging', 'Browsers'];

interface MarketplaceEmptyStateProps {
  isSearching: boolean;
  hasQuery: boolean;
  onQuickSearch: (query: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Clock3;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export function MarketplaceEmptyState({
  isSearching,
  hasQuery,
  onQuickSearch,
}: MarketplaceEmptyStateProps) {
  const trendingApps = useMarketplaceStore((state) => state.trendingApps);
  const isTrendingLoading = useMarketplaceStore((state) => state.isTrendingLoading);
  const recentReleaseApps = useMarketplaceStore((state) => state.recentReleaseApps);
  const isRecentReleaseLoading = useMarketplaceStore((state) => state.isRecentReleaseLoading);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const recentlyViewedApps = useMarketplaceStore((state) => state.recentlyViewedApps);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const openSettings = useMarketplaceStore((state) => state.openSettings);

  useMarketplaceHome(hasQuery);

  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Loader2 className="mb-3 size-8 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium">Searching across your selected sources…</p>
        <p className="mt-1 text-xs">Results update as soon as the latest request completes.</p>
      </div>
    );
  }

  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Search className="mb-3 size-8 opacity-60" aria-hidden="true" />
        <p className="text-sm font-medium">No apps matched that search</p>
        <p className="mt-1 text-xs">Try a different term, open more sources, or change the sort.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Compass className="size-5 text-muted-foreground" aria-hidden="true" />
          Discover Android apps faster
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Search when you know what you want, or start with recent activity, curated collections,
          and trusted sources when you are exploring.
        </p>
      </div>

      {(searchHistory.length > 0 || recentlyViewedApps.length > 0) && (
        <div className="space-y-4">
          <SectionHeader
            icon={Clock3}
            title="Continue exploring"
            description="Jump back into recent searches or reopen apps you inspected earlier."
          />
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 6).map((entry) => (
              <Button
                key={entry}
                variant="outline"
                size="sm"
                className="h-8 rounded-full"
                onClick={() => onQuickSearch(entry)}
              >
                {entry}
              </Button>
            ))}
          </div>
          {recentlyViewedApps.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentlyViewedApps.slice(0, 3).map((app) => (
                <AppCard
                  key={`${app.source}-${app.packageName}`}
                  app={app}
                  onSelect={() => openDetail(app)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SectionHeader
          icon={Sparkles}
          title="Browse by collection"
          description="Use these quick-launch collections as starting points when you are not searching for one exact package."
        />
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.map((collection) => (
            <Button
              key={collection}
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={() => onQuickSearch(collection)}
            >
              {collection}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <SectionHeader
              icon={TrendingUp}
              title="Trending right now"
              description="Popular GitHub Android projects, cached for faster loading."
            />
            {isTrendingLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {trendingApps.slice(0, 6).map((app) => (
                  <AppCard
                    key={`${app.source}-${app.packageName}`}
                    app={app}
                    onSelect={() => openDetail(app)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeader
              icon={Sparkles}
              title="Fresh releases"
              description="Recently updated Android projects to help you discover what changed lately."
            />
            {isRecentReleaseLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recentReleaseApps.slice(0, 3).map((app) => (
                  <AppCard
                    key={`${app.source}-${app.packageName}`}
                    app={app}
                    onSelect={() => openDetail(app)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={UserRound}
              title={
                githubSession.user
                  ? `Signed in as ${githubSession.user.login}`
                  : 'Optional GitHub sign-in'
              }
              description={
                githubSession.user
                  ? 'Signed-in sessions can help with GitHub rate limits and richer discovery.'
                  : 'Sign in with GitHub to improve rate limits and future GitHub-powered discovery features.'
              }
            />
            {githubSession.rateLimit && (
              <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                <p>
                  API remaining:{' '}
                  <span className="font-medium text-foreground">
                    {githubSession.rateLimit.remaining}
                  </span>{' '}
                  / {githubSession.rateLimit.limit}
                </p>
              </div>
            )}
            <Separator />
            <Button
              className="w-full"
              variant={githubSession.user ? 'outline' : 'default'}
              onClick={openSettings}
            >
              {githubSession.user
                ? 'Manage GitHub session'
                : githubOauthClientId
                  ? 'Configure GitHub sign-in'
                  : 'Add GitHub OAuth client ID'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Anonymous browsing remains available even if you do not sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
