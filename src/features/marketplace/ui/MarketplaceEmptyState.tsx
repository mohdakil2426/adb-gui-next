import { Clock3, Compass, Loader2, Search, Sparkles, UserRound } from 'lucide-react';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { AppCard } from './AppCard';

const COLLECTIONS = ['Privacy', 'Media', 'Developer Tools', 'File Tools', 'Messaging', 'Browsers'];

interface MarketplaceEmptyStateProps {
  hasQuery: boolean;
  isSearching: boolean;
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
        <div className="flex items-center gap-2 font-medium text-sm">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          <span>{title}</span>
        </div>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
    </div>
  );
}

export function MarketplaceEmptyState({
  isSearching,
  hasQuery,
  onQuickSearch,
}: MarketplaceEmptyStateProps) {
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const recentlyViewedApps = useMarketplaceStore((state) => state.recentlyViewedApps);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const openSettings = useMarketplaceStore((state) => state.openSettings);

  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Loader2 aria-hidden="true" className="mb-3 size-8 animate-spin" />
        <p className="font-medium text-sm">Searching across your selected sources…</p>
        <p className="mt-1 text-xs">Results update as soon as the latest request completes.</p>
      </div>
    );
  }

  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Search aria-hidden="true" className="mb-3 size-8 opacity-60" />
        <p className="font-medium text-sm">No apps matched that search</p>
        <p className="mt-1 text-xs">Try a different term, open more sources, or change the sort.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Compass aria-hidden="true" className="size-5 text-muted-foreground" />
          Discover Android apps faster
        </div>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Search when you know what you want, or start with recent activity, curated collections,
          and trusted sources when you are exploring.
        </p>
      </div>

      {(searchHistory.length > 0 || recentlyViewedApps.length > 0) && (
        <div className="flex flex-col gap-4">
          <SectionHeader
            description="Jump back into recent searches or reopen apps you inspected earlier."
            icon={Clock3}
            title="Continue exploring"
          />
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 6).map((entry) => (
              <Button
                className="h-8 rounded-full"
                key={entry}
                onClick={() => {
                  onQuickSearch(entry);
                }}
                size="sm"
                variant="outline"
              >
                {entry}
              </Button>
            ))}
          </div>
          {recentlyViewedApps.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentlyViewedApps.slice(0, 3).map((app) => (
                <AppCard
                  app={app}
                  key={`${app.source}-${app.packageName}`}
                  onSelect={() => {
                    openDetail(app);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SectionHeader
          description="Use these quick-launch collections as starting points when you are not searching for one exact package."
          icon={Sparkles}
          title="Browse by collection"
        />
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.map((collection) => (
            <Button
              className="h-8 rounded-full"
              key={collection}
              onClick={() => {
                onQuickSearch(collection);
              }}
              size="sm"
              variant="outline"
            >
              {collection}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-col gap-3">
          <SectionHeader
            description={
              githubSession.user
                ? 'Signed-in sessions can help with GitHub rate limits and richer discovery.'
                : 'Sign in with GitHub to improve rate limits and future GitHub-powered discovery features.'
            }
            icon={UserRound}
            title={
              githubSession.user
                ? `Signed in as ${githubSession.user.login}`
                : 'Optional GitHub sign-in'
            }
          />
          {githubSession.rateLimit ? (
            <div className="rounded-lg border bg-background/70 p-3 text-muted-foreground text-xs">
              <p>
                API remaining:{' '}
                <span className="font-medium text-foreground">
                  {githubSession.rateLimit.remaining}
                </span>{' '}
                / {githubSession.rateLimit.limit}
              </p>
            </div>
          ) : null}
          <Separator />
          <Button
            className="w-full"
            onClick={openSettings}
            variant={githubSession.user ? 'outline' : 'default'}
          >
            {githubSession.user
              ? 'Manage GitHub session'
              : githubOauthClientId
                ? 'Configure GitHub sign-in'
                : 'Add GitHub OAuth client ID'}
          </Button>
          <p className="text-muted-foreground text-xs">
            Anonymous browsing remains available even if you do not sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
