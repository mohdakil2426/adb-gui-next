import { Flame, Package, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MarketplaceGetCuratedTools } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { AppInstallButton } from '@/features/marketplace/ui/AppInstallButton';
import { ProviderBadge } from '@/features/marketplace/ui/ProviderBadge';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card';

type MarketplaceApp = backend.MarketplaceApp;

interface CuratedPowerToolsGridProps {
  onSelectApp: (app: MarketplaceApp) => void;
  target: InstallTarget;
}

export function CuratedPowerToolsGrid({ onSelectApp, target }: CuratedPowerToolsGridProps) {
  const [tools, setTools] = useState<MarketplaceApp[]>([]);

  useEffect(() => {
    let cancelled = false;
    MarketplaceGetCuratedTools()
      .then((data) => {
        if (!cancelled) {
          setTools(data ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTools([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-warning" />
          <h3 className="font-semibold text-body text-foreground">
            Curated Open-Source Android Power Tools
          </h3>
        </div>
        <Badge className="font-mono text-caption text-muted-foreground" variant="outline">
          {tools.length} Essential Tools
        </Badge>
      </div>

      <div className="grid @2xl:grid-cols-4 @lg:grid-cols-2 @xs:grid-cols-1 gap-3">
        {tools.map((app) => (
          <Card
            className="flex flex-col justify-between gap-0 rounded-lg border-border bg-surface py-0 shadow-none transition-all duration-150 hover:border-border-strong hover:bg-surface-raised/40"
            key={app.packageName}
          >
            <button
              aria-label={`Inspect ${app.name}`}
              className="flex w-full flex-1 cursor-pointer flex-col gap-2.5 p-3.5 text-left"
              onClick={() => onSelectApp(app)}
              type="button"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2.5 p-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
                    {app.iconUrl ? (
                      <img
                        alt=""
                        className="size-10 object-cover"
                        height={40}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        src={app.iconUrl}
                        width={40}
                      />
                    ) : (
                      <Package className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-semibold text-body text-foreground">
                        {app.name}
                      </span>
                    </div>
                    <span className="truncate font-mono text-caption text-muted-foreground">
                      {app.packageName}
                    </span>
                  </div>
                </div>
                <ProviderBadge compact source={app.source} />
              </CardHeader>

              <CardContent className="flex flex-col gap-2 p-0">
                <p className="line-clamp-2 text-caption text-muted-foreground leading-relaxed">
                  {app.summary}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {(app.categories ?? []).slice(0, 2).map((cat) => (
                    <span
                      className="rounded border border-border/50 bg-surface-raised px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground"
                      key={cat}
                    >
                      {cat}
                    </span>
                  ))}
                  {app.downloadsCount ? (
                    <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-caption text-muted-foreground">
                      <Star className="size-3 fill-current text-warning" />
                      {(app.downloadsCount / 1000).toFixed(1)}k
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </button>

            <CardFooter className="mt-auto flex items-center justify-between border-border/40 border-t bg-surface-raised/20 p-3 pt-0">
              <span className="truncate font-mono text-caption text-muted-foreground">
                {app.version}
              </span>
              <AppInstallButton app={app} onSelect={onSelectApp} target={target} />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
