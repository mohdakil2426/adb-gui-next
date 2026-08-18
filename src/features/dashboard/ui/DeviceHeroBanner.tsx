import {
  Clock,
  Cpu,
  Edit3,
  Fingerprint,
  Globe,
  Hash,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wifi,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { isWirelessSerial } from '@/features/dashboard/model/deviceMode';
import { CopyButton } from '@/shared/components/CopyButton';
import { useNickname } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { getStatusConfig } from '@/shared/utils/deviceStatus';
import { EMPTY_VALUE, formatDuration } from '@/shared/utils/format';

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

interface DeviceHeroBannerProps {
  device: backend.Device;
  isLoading: boolean;
  isRefreshing?: boolean | undefined;
  onEditNickname?: (() => void) | undefined;
  onRefresh?: (() => void) | undefined;
  telemetry: backend.DeviceTelemetry | null;
  updatedAt?: number | undefined;
}

function SpecBadge({
  copyValue,
  icon: Icon,
  label,
  tooltip,
  value,
}: {
  copyValue?: string | undefined;
  icon: typeof Smartphone;
  label: string;
  tooltip?: string | undefined;
  value: string;
}) {
  return (
    <div
      className="group relative flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 transition-colors hover:bg-surface-raised/80"
      title={tooltip || value}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span className="truncate font-medium text-[12px] text-body text-foreground">
            {value}
          </span>
        </div>
      </div>
      {copyValue ? (
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton className="size-5" label={label} value={copyValue} />
        </div>
      ) : null}
    </div>
  );
}

function formatKernelRelease(kernel: string | null | undefined): string {
  if (!kernel) {
    return EMPTY_VALUE;
  }
  if (kernel.startsWith('Linux version ')) {
    const parts = kernel.substring('Linux version '.length).trim().split(/\s+/);
    return parts[0] || kernel;
  }
  return kernel;
}

export function DeviceHeroBanner({
  device,
  isLoading,
  isRefreshing,
  onEditNickname,
  onRefresh,
  telemetry,
  updatedAt,
}: DeviceHeroBannerProps) {
  const nickname = useNickname(device.serial);
  const identity = telemetry?.identity;
  const security = telemetry?.security;
  const status = getStatusConfig(device.status);

  const headline = nickname ?? identity?.deviceName ?? identity?.model ?? device.serial;
  const vendorLine = [identity?.brand, identity?.codename].filter(Boolean).join(' · ');
  const androidLabel = identity?.androidVersion
    ? `Android ${identity.androidVersion}${identity.sdkInt ? ` (API ${identity.sdkInt})` : ''}`
    : 'Android';

  return (
    <Card className="@container rounded-xl border-border bg-surface p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Top Row: Device Identity, Badges & Consolidated Sync Capsule */}
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised p-2 text-foreground shadow-xs">
              <Smartphone aria-hidden="true" className="size-6 text-foreground" />
              {/* Active connection pulse dot */}
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-3 rounded-full border-2 border-surface bg-success" />
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-semibold text-foreground text-title">{headline}</h2>
                {onEditNickname ? (
                  <button
                    className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={onEditNickname}
                    title="Edit device nickname"
                    type="button"
                  >
                    <Edit3 className="size-3" />
                  </button>
                ) : null}
                <Badge className={status.badgeClass} variant={status.variant}>
                  {status.label}
                </Badge>
                {isWirelessSerial(device.serial) ? (
                  <Badge className="gap-1 font-mono text-[10px]" variant="info">
                    <Wifi aria-hidden="true" className="size-3" />
                    Wi-Fi ADB
                  </Badge>
                ) : null}
              </div>

              {isLoading && !vendorLine ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <p className="truncate text-caption text-muted-foreground">
                  {vendorLine || 'Connected Android Device'}
                </p>
              )}
            </div>
          </div>

          {/* Top-Right Consolidated Refresh & Status Capsule */}
          <div className="flex items-center gap-2.5 @lg:self-auto self-start">
            {updatedAt && updatedAt > 0 ? (
              <span className="numeric text-[11px] text-caption text-muted-foreground">
                Updated {updatedAtFormatter.format(updatedAt)}
              </span>
            ) : null}
            {onRefresh ? (
              <Button
                aria-label="Refresh telemetry and scan devices"
                className="size-7 rounded-lg p-0"
                disabled={isLoading || isRefreshing}
                onClick={onRefresh}
                size="sm"
                title="Refresh telemetry & scan devices"
                type="button"
                variant="outline"
              >
                <RefreshCw
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform',
                    isRefreshing ? 'animate-spin text-foreground' : '',
                  )}
                />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Expanded 8-Spec Grid */}
        <div className="grid @3xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-2.5 border-border/50 border-t pt-3">
          {/* Row 1: Software & OS Stack */}
          <SpecBadge
            copyValue={identity?.androidVersion ? `Android ${identity.androidVersion}` : undefined}
            icon={Smartphone}
            label="Platform"
            value={androidLabel}
          />
          <SpecBadge
            copyValue={identity?.buildId ?? undefined}
            icon={Fingerprint}
            label="Build Number"
            value={identity?.buildId ?? EMPTY_VALUE}
          />
          <SpecBadge
            copyValue={security?.securityPatch ?? undefined}
            icon={ShieldCheck}
            label="Security Patch"
            value={security?.securityPatch ?? EMPTY_VALUE}
          />
          <SpecBadge
            copyValue={identity?.kernelVersion ?? undefined}
            icon={Terminal}
            label="Kernel Version"
            tooltip={identity?.kernelVersion ?? undefined}
            value={formatKernelRelease(identity?.kernelVersion)}
          />

          {/* Row 2: Hardware & Runtime Environment */}
          <SpecBadge
            copyValue={device.serial}
            icon={Hash}
            label="Serial Number"
            value={device.serial}
          />
          <SpecBadge
            icon={Cpu}
            label="Architecture"
            value={
              identity?.arch
                ? `${identity.arch} (${identity.hardware ?? 'SOC'})`
                : (identity?.hardware ?? EMPTY_VALUE)
            }
          />
          <SpecBadge
            icon={Clock}
            label="Device Uptime"
            value={telemetry ? formatDuration(telemetry.uptimeSeconds) : EMPTY_VALUE}
          />
          <SpecBadge
            icon={Globe}
            label="Locale / Timezone"
            value={
              identity?.locale && identity?.timezone
                ? `${identity.locale} · ${identity.timezone}`
                : (identity?.timezone ?? identity?.locale ?? EMPTY_VALUE)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
