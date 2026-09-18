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
} from "lucide-react";

import type { backend } from "@/desktop/models";
import { isWirelessSerial } from "@/features/dashboard/model/device-mode";
import { CopyButton } from "@/shared/components/copy-button";
import { useNickname } from "@/shared/stores/nickname-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { getStatusConfig } from "@/shared/utils/device-status";
import { EMPTY_VALUE, formatDuration } from "@/shared/utils/format";

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: "medium",
});

interface DeviceHeroBannerProps {
  device: backend.Device;
  isLoading: boolean;
  isRefreshing?: boolean | undefined;
  onEditNickname?: (() => void) | undefined;
  onRefresh?: (() => void) | undefined;
  telemetry: backend.DeviceTelemetry | null;
  updatedAt?: number | undefined;
}

const SpecBadge = ({
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
}) => (
  <div
    className="group relative flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 transition-colors hover:border-border hover:bg-surface-raised/80"
    title={tooltip || value}
  >
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-caption text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="truncate font-medium text-foreground text-label">{value}</span>
      </div>
    </div>
    {copyValue ? (
      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton className="size-5" label={label} value={copyValue} />
      </div>
    ) : null}
  </div>
);

const formatKernelRelease = (kernel: string | null | undefined): string => {
  if (!kernel) {
    return EMPTY_VALUE;
  }
  if (kernel.startsWith("Linux version ")) {
    const parts = kernel.slice("Linux version ".length).trim().split(/\s+/u);
    return parts[0] || kernel;
  }
  return kernel;
};

const DeviceRefreshControl = ({
  isLoading,
  isRefreshing,
  onRefresh,
  updatedAt,
}: {
  isLoading?: boolean | undefined;
  isRefreshing?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
  updatedAt?: number | undefined;
}) => (
  <div className="flex items-center gap-2.5 @lg:self-auto self-start">
    {updatedAt && updatedAt > 0 ? (
      <span className="numeric text-caption text-muted-foreground">
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
          aria-hidden="true"
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            isRefreshing ? "animate-spin text-foreground" : ""
          )}
          data-icon="inline-start"
        />
      </Button>
    ) : null}
  </div>
);

const SoftwareSpecsRow = ({
  androidLabel,
  identity,
  security,
}: {
  androidLabel: string;
  identity: backend.DeviceIdentity | undefined;
  security: backend.SecurityInfo | undefined;
}) => (
  <>
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
  </>
);

const HardwareSpecsRow = ({
  deviceSerial,
  identity,
  telemetry,
}: {
  deviceSerial: string;
  identity: backend.DeviceIdentity | undefined;
  telemetry: backend.DeviceTelemetry | null;
}) => {
  const archValue = identity?.arch
    ? `${identity.arch} (${identity.hardware ?? "SOC"})`
    : (identity?.hardware ?? EMPTY_VALUE);
  const localeValue =
    identity?.locale && identity?.timezone
      ? `${identity.locale} · ${identity.timezone}`
      : (identity?.timezone ?? identity?.locale ?? EMPTY_VALUE);

  return (
    <>
      <SpecBadge copyValue={deviceSerial} icon={Hash} label="Serial Number" value={deviceSerial} />
      <SpecBadge icon={Cpu} label="Architecture" value={archValue} />
      <SpecBadge
        icon={Clock}
        label="Device Uptime"
        value={telemetry ? formatDuration(telemetry.uptimeSeconds) : EMPTY_VALUE}
      />
      <SpecBadge icon={Globe} label="Locale / Timezone" value={localeValue} />
    </>
  );
};

const DeviceHardwareGrid = ({
  androidLabel,
  deviceSerial,
  identity,
  security,
  telemetry,
}: {
  androidLabel: string;
  deviceSerial: string;
  identity: backend.DeviceIdentity | undefined;
  security: backend.SecurityInfo | undefined;
  telemetry: backend.DeviceTelemetry | null;
}) => (
  <div className="grid @3xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-2.5 border-border/50 border-t pt-3">
    <SoftwareSpecsRow androidLabel={androidLabel} identity={identity} security={security} />
    <HardwareSpecsRow deviceSerial={deviceSerial} identity={identity} telemetry={telemetry} />
  </div>
);

export const DeviceHeroBanner = ({
  device,
  isLoading,
  isRefreshing,
  onEditNickname,
  onRefresh,
  telemetry,
  updatedAt,
}: DeviceHeroBannerProps) => {
  const nickname = useNickname(device.serial);
  const identity = telemetry?.identity;
  const security = telemetry?.security;
  const status = getStatusConfig(device.status);

  const headline = nickname ?? identity?.deviceName ?? identity?.model ?? device.serial;
  const vendorLine = [identity?.brand, identity?.codename].filter(Boolean).join(" · ");
  const androidLabel = identity?.androidVersion
    ? `Android ${identity.androidVersion}${identity.sdkInt ? ` (API ${identity.sdkInt})` : ""}`
    : "Android";

  return (
    <Card className="@container rounded-xl border-border bg-surface p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Identity row */}
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
                    aria-label="Edit device nickname"
                    className="flex size-6 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={onEditNickname}
                    title="Edit device nickname"
                    type="button"
                  >
                    <Edit3 aria-hidden="true" className="size-3.5" />
                  </button>
                ) : null}
                <Badge className={status.badgeClass} variant={status.variant}>
                  {status.label}
                </Badge>
                {isWirelessSerial(device.serial) ? (
                  <Badge className="gap-1 font-mono text-caption" variant="info">
                    <Wifi aria-hidden="true" className="size-3" />
                    Wi-Fi ADB
                  </Badge>
                ) : null}
              </div>

              {isLoading && !vendorLine ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <p className="truncate text-caption text-muted-foreground">
                  {vendorLine || "Connected Android Device"}
                </p>
              )}
            </div>
          </div>

          <DeviceRefreshControl
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
            updatedAt={updatedAt}
          />
        </div>
        <DeviceHardwareGrid
          androidLabel={androidLabel}
          deviceSerial={device.serial}
          identity={identity}
          security={security}
          telemetry={telemetry}
        />
      </CardContent>
    </Card>
  );
};
