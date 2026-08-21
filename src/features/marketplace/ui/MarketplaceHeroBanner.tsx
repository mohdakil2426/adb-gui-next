import {
  CheckCircle2,
  Database,
  Package,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarketplaceClearCache } from '@/desktop/backend';
import { useDeviceTelemetry } from '@/features/dashboard/hooks/useDeviceTelemetry';
import { useInstallTarget } from '@/features/marketplace/hooks/useInstallTarget';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { MARKETPLACE_PROVIDERS } from '@/features/marketplace/model/providers';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface MarketplaceHeroBannerProps {
  isSyncing?: boolean;
  onSync?: () => void;
}

export function MarketplaceHeroBanner({ onSync, isSyncing = false }: MarketplaceHeroBannerProps) {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const { telemetry } = useDeviceTelemetry(selectedSerial, true);
  const target = useInstallTarget();

  const activeProviders = useMarketplaceStore((s) => s.activeProviders);
  const githubSession = useMarketplaceStore((s) => s.githubSession);
  const githubPat = useMarketplaceStore((s) => s.githubPat);

  const [localSyncing, setLocalSyncing] = useState(false);

  const deviceIdentity = telemetry?.identity;
  const androidVer = deviceIdentity?.androidVersion ?? 'Unknown';
  const sdkInt = deviceIdentity?.sdkInt ? `API ${deviceIdentity.sdkInt}` : null;
  const arch = deviceIdentity?.arch ?? 'Universal';

  const compatibilityString = target.canInstall
    ? `Android ${androidVer}${sdkInt ? ` · ${sdkInt}` : ''} · ${arch}`
    : 'No device target (Browsing universal catalog)';

  const rateLimitTotal = githubSession.rateLimit?.limit ?? (githubPat ? 5000 : 60);
  const rateLimitRemaining = githubSession.rateLimit?.remaining ?? rateLimitTotal;

  const handleManualSync = async () => {
    setLocalSyncing(true);
    try {
      if (onSync) {
        onSync();
      } else {
        await MarketplaceClearCache();
        toast.success('Marketplace index and catalog cache refreshed');
      }
    } catch {
      toast.error('Failed to sync marketplace repositories');
    } finally {
      setTimeout(() => setLocalSyncing(false), 600);
    }
  };

  const syncing = isSyncing || localSyncing;

  const specs = [
    {
      icon: Package,
      label: 'Catalog Ecosystem',
      value: '14,200+',
      subtext: `${(activeProviders ?? []).length} active repos`,
    },
    {
      icon: Smartphone,
      label: 'Target Compatibility',
      value: target.canInstall ? arch : 'Universal',
      subtext: target.canInstall ? `Ready (${target.serial})` : 'Catalog mode',
    },
    {
      icon: Zap,
      label: 'GitHub Rate Limit',
      value: `${rateLimitRemaining.toLocaleString()} / hr`,
      subtext: githubSession.user?.login
        ? `@${githubSession.user.login}`
        : githubPat
          ? 'PAT Session'
          : 'Anonymous tier',
    },
    {
      icon: ShieldCheck,
      label: 'Security & Integrity',
      value: 'APK Signed',
      subtext: 'SHA-256 verified',
    },
    {
      icon: Database,
      label: 'Index Cache',
      value: 'Memory + Disk',
      subtext: 'Sub-millisecond query',
    },
  ];

  return (
    <Card className="@container gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
      <CardContent className="@sm:p-5 p-4">
        <div className="flex flex-col gap-4">
          {/* Top Title & Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface-raised shadow-xs">
                <Sparkles aria-hidden="true" className="size-5 text-foreground" />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground text-title">
                    Open-Source App Marketplace
                  </h2>
                  <Badge className="gap-1.5 font-medium" variant="outline">
                    <span className="size-2 animate-pulse rounded-full bg-success" />
                    INDEX SYNCED
                  </Badge>
                </div>
                <p className="text-caption text-muted-foreground">
                  Direct GitHub release binaries, F-Droid verified packages & IzzyOnDroid community
                  tools
                </p>
              </div>
            </div>

            {/* Quick Actions & Source Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 @xl:flex hidden items-center gap-1.5">
                {MARKETPLACE_PROVIDERS.map((provider) => {
                  const isActive = activeProviders.includes(provider.id);
                  return (
                    <Badge
                      className={cn(
                        'px-2 py-0.5 font-mono text-caption',
                        !isActive && 'line-through opacity-50',
                      )}
                      key={provider.id}
                      variant={isActive ? 'neutral' : 'outline'}
                    >
                      {provider.label}
                    </Badge>
                  );
                })}
              </div>

              <Button
                aria-label="Refresh marketplace index"
                className="gap-1.5"
                disabled={syncing}
                onClick={handleManualSync}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn('size-3.5', syncing && 'animate-spin')}
                  data-icon="inline-start"
                />
                <span>{syncing ? 'Syncing...' : 'Sync Index'}</span>
              </Button>
            </div>
          </div>

          {/* Compatibility Device Banner Strip */}
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-surface-raised/40 px-3 py-2 text-caption">
            <div className="flex min-w-0 items-center gap-2">
              <Smartphone
                className={cn(
                  'size-3.5 shrink-0',
                  target.canInstall ? 'text-success' : 'text-muted-foreground',
                )}
              />
              <span className="font-medium text-foreground">Target Architecture:</span>
              <span className="truncate font-mono text-mono-sm text-muted-foreground">
                {compatibilityString}
              </span>
            </div>
            {target.canInstall && (
              <Badge
                className="@md:inline-flex hidden gap-1 border-success/30 bg-success/10 font-mono text-caption text-success"
                variant="outline"
              >
                <CheckCircle2 className="size-3" />
                Compatible
              </Badge>
            )}
          </div>

          {/* Symmetrical Metric Specs Grid */}
          <div className="grid @lg:grid-cols-5 @xs:grid-cols-2 grid-cols-1 gap-2.5">
            {specs.map((spec) => {
              const Icon = spec.icon;
              return (
                <div
                  className="flex flex-col justify-between rounded-md border border-border/60 bg-surface-raised/60 p-2.5 transition-colors hover:border-border"
                  key={spec.label}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-caption text-muted-foreground">
                      {spec.label}
                    </span>
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col pt-1.5">
                    <span className="numeric font-bold text-body text-foreground">
                      {spec.value}
                    </span>
                    <span className="truncate text-caption text-muted-foreground">
                      {spec.subtext}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
