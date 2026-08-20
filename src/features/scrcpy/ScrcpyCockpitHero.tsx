import {
  ArrowUpRight,
  DownloadCloud,
  Loader2,
  Monitor,
  Radio,
  Rocket,
  ShieldCheck,
  Smartphone,
  Square,
  Usb,
  Wifi,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

export type ScrcpyCockpitActionState = 'idle' | 'installing' | 'launching' | 'stopping';

interface ScrcpyCockpitHeroProps {
  actionState?: ScrcpyCockpitActionState | undefined;
  activeSerials: Set<string>;
  canLaunch: boolean;
  onLaunch: () => void;
  onStopAll: () => void;
  progress: backend.ScrcpyDownloadProgress | null;
  selectedSerials: Set<string>;
  status: backend.ScrcpyStatus | undefined;
  totalDevicesCount: number;
}

export function ScrcpyCockpitHero({
  actionState = 'idle',
  activeSerials,
  canLaunch,
  onLaunch,
  onStopAll,
  progress,
  selectedSerials,
  status,
  totalDevicesCount,
}: ScrcpyCockpitHeroProps) {
  const isInstalling = actionState === 'installing';
  const isLaunching = actionState === 'launching';
  const isStopping = actionState === 'stopping';
  const isInstalled = Boolean(status?.binaryPath);
  const activeCount = activeSerials.size;
  const selectedCount = selectedSerials.size;

  const updateAvailable =
    Boolean(status?.latestVersion) &&
    Boolean(status?.installedVersion) &&
    status?.latestVersion !== status?.installedVersion;

  // Determine transport type across selected devices
  const hasWireless = Array.from(selectedSerials).some((s) => s.includes(':'));
  const hasUsb = Array.from(selectedSerials).some((s) => !s.includes(':'));

  let transportLabel = 'No device selected';
  let TransportIcon = Smartphone;

  if (selectedCount > 0) {
    if (hasWireless && hasUsb) {
      transportLabel = 'Mixed USB & Wireless';
      TransportIcon = Radio;
    } else if (hasWireless) {
      transportLabel = 'Wireless TCP 5555';
      TransportIcon = Wifi;
    } else {
      transportLabel = 'USB 3.0 / USB 2.0';
      TransportIcon = Usb;
    }
  }

  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null;

  return (
    <Card className="@container border-border bg-surface shadow-none">
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Top Header Row */}
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-foreground">
              <Monitor aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground text-title tracking-tight">
                  Scrcpy Engine Cockpit
                </h2>
                {isInstalling ? (
                  <Badge
                    className="border-sky-500/30 bg-sky-500/10 text-caption text-sky-400"
                    variant="outline"
                  >
                    <DownloadCloud aria-hidden="true" className="size-3 animate-pulse" />
                    Downloading {percent === null ? '...' : `${percent}%`}
                  </Badge>
                ) : updateAvailable ? (
                  <Badge
                    className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-caption"
                    variant="outline"
                  >
                    <ArrowUpRight aria-hidden="true" className="size-3" />
                    Update {status?.latestVersion} Available
                  </Badge>
                ) : isInstalled ? (
                  <Badge
                    className="border-emerald-500/30 bg-emerald-500/10 text-caption text-emerald-400"
                    variant="outline"
                  >
                    <ShieldCheck aria-hidden="true" className="size-3" />
                    {status?.installedVersion ?? 'Installed'}
                  </Badge>
                ) : (
                  <Badge
                    className="border-border bg-surface-raised text-caption text-muted-foreground"
                    variant="outline"
                  >
                    Not Installed
                  </Badge>
                )}
              </div>
              <p className="truncate text-caption text-muted-foreground">
                High-performance Genymobile display mirroring & hardware device bridge
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 @lg:self-auto self-start">
            {activeCount > 0 ? (
              <Button
                className="h-8 gap-1.5 px-3 text-caption hover:bg-destructive/10 hover:text-destructive"
                disabled={isStopping}
                onClick={onStopAll}
                size="sm"
                type="button"
                variant="outline"
              >
                {isStopping ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Square aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                )}
                <span>Stop All ({activeCount})</span>
              </Button>
            ) : null}

            <Button
              className="h-8 gap-1.5 bg-foreground px-3.5 font-medium text-background text-caption hover:bg-foreground/90"
              disabled={!canLaunch || isLaunching || selectedCount === 0}
              onClick={onLaunch}
              size="sm"
              type="button"
            >
              {isLaunching ? (
                <Loader2
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Rocket aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              )}
              <span>
                Launch Mirror
                {selectedCount > 1 ? ` (${selectedCount})` : ''}
              </span>
            </Button>
          </div>
        </div>

        {/* Telemetry Strip Metric Tiles */}
        <div className="grid @lg:grid-cols-4 grid-cols-2 gap-2">
          {/* Tile 1: Binary Engine Status */}
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Scrcpy Engine
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'size-2 rounded-full',
                  isInstalled ? 'bg-emerald-500' : 'bg-muted-foreground',
                )}
              />
              <span className="truncate font-medium text-body text-foreground">
                {isInstalled
                  ? (status?.installedVersion ?? 'Engine Ready')
                  : status?.source === 'path'
                    ? 'PATH Binary'
                    : 'Unmanaged'}
              </span>
            </div>
          </div>

          {/* Tile 2: Live Mirroring Sessions */}
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Active Sessions
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'size-2 rounded-full',
                  activeCount > 0 ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/50',
                )}
              />
              <span className="truncate font-medium text-body text-foreground">
                {activeCount > 0 ? `${activeCount} Streaming` : 'Standby / Idle'}
              </span>
            </div>
          </div>

          {/* Tile 3: Device Targets */}
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Device Targets
            </span>
            <div className="flex items-center gap-1.5 text-foreground">
              <Smartphone aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate font-medium text-body">
                {totalDevicesCount > 0
                  ? `${selectedCount} of ${totalDevicesCount} Selected`
                  : '0 Devices'}
              </span>
            </div>
          </div>

          {/* Tile 4: Connection Transport */}
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Transport
            </span>
            <div className="flex items-center gap-1.5 text-foreground">
              <TransportIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate font-medium text-body">{transportLabel}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
