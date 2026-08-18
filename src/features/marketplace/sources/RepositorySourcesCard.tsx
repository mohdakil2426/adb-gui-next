import { ExternalLink, GitBranch, Package, Store } from 'lucide-react';
import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Switch } from '@/shared/ui/switch';

const PROVIDER_DETAILS = [
  {
    badge: '5,000 req/hr authenticated',
    description:
      'Fetches release APK assets and markdown READMEs directly from open-source repositories.',
    icon: GitBranch,
    id: 'GitHub' as const,
    label: 'GitHub Releases',
    url: 'https://github.com',
  },
  {
    badge: '4,800+ apps',
    description:
      'Index of community-verified free and open-source Android binaries with reproducible builds.',
    icon: Package,
    id: 'F-Droid' as const,
    label: 'F-Droid Official Repository',
    url: 'https://f-droid.org',
  },
  {
    badge: '3,200+ apps',
    description:
      'Rapid updates and developer-maintained release channels for cutting-edge APK utilities.',
    icon: Store,
    id: 'Aptoide' as const,
    label: 'IzzyOnDroid / Community Repos',
    url: 'https://apt.izzysoft.de',
  },
];

export function RepositorySourcesCard() {
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const toggleProvider = useMarketplaceStore((state) => state.toggleProvider);
  const setAllProviders = useMarketplaceStore((state) => state.setAllProviders);
  const setActiveProviders = useMarketplaceStore((state) => state.setActiveProviders);

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Store className="size-5 text-muted-foreground" />
            Enabled Repository Catalogs
          </CardTitle>
          <CardDescription className="text-caption">
            Select which open-source repositories to query during searches and discovery.
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setAllProviders()}
            size="sm"
            type="button"
            variant="outline"
          >
            Enable All
          </Button>
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setActiveProviders(['GitHub'])}
            size="sm"
            type="button"
            variant="outline"
          >
            GitHub Only
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-1">
        {PROVIDER_DETAILS.map((provider) => {
          const Icon = provider.icon;
          const isEnabled = activeProviders.includes(provider.id);

          return (
            <div
              className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5 transition-colors"
              key={provider.id}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised">
                  <Icon className="size-4.5 text-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-body text-foreground">
                      {provider.label}
                    </span>
                    <Badge className="text-[10px]" variant="secondary">
                      {provider.badge}
                    </Badge>
                  </div>
                  <p className="text-caption text-muted-foreground">{provider.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  aria-label={`Open ${provider.label} website`}
                  className="size-7 p-0"
                  onClick={() => {
                    void BrowserOpenURL(provider.url);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </Button>
                <Switch
                  aria-label={`Toggle ${provider.label}`}
                  checked={isEnabled}
                  onCheckedChange={() => toggleProvider(provider.id)}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
