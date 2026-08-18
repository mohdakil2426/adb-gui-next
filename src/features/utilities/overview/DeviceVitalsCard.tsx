import {
  Activity,
  Battery,
  CheckCircle2,
  Cpu,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { CopyButton } from '@/shared/components/CopyButton';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface DeviceVitalsCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  displayVitals?: { dpi: string; resolution?: string | undefined } | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  telemetry: backend.DeviceTelemetry | null | undefined;
}

export function DeviceVitalsCard({
  deviceMode,
  deviceSerial,
  displayVitals,
  isLoading,
  onRefresh,
  telemetry,
}: DeviceVitalsCardProps) {
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);

  const vitalsItems = [
    {
      copyValue: isAdb ? 'Authorized' : 'Disconnected',
      icon: CheckCircle2,
      id: 'debugging',
      label: 'USB Debugging',
      status: isAdb ? 'Authorized & Online' : 'Unavailable',
      subtext: deviceSerial ? `Target ${deviceSerial}` : 'No device connected',
      variant: isAdb ? 'success' : 'outline',
    },
    {
      copyValue:
        telemetry?.battery?.levelPct !== null && telemetry?.battery?.levelPct !== undefined
          ? `${telemetry.battery.levelPct}%`
          : undefined,
      icon: Battery,
      id: 'battery',
      label: 'Battery & Thermals',
      status:
        telemetry?.battery?.levelPct !== null && telemetry?.battery?.levelPct !== undefined
          ? `${telemetry.battery.levelPct}% Charge`
          : 'Host Powered',
      subtext: telemetry?.battery?.temperatureC
        ? `${telemetry.battery.temperatureC.toFixed(1)}°C · ${telemetry.battery.voltageMv ? `${(telemetry.battery.voltageMv / 1000).toFixed(2)}V` : 'Normal'}`
        : 'Thermal sensor idle',
      variant:
        telemetry?.battery?.levelPct && telemetry.battery.levelPct < 20
          ? 'destructive'
          : telemetry?.battery?.levelPct
            ? 'success'
            : 'default',
    },
    {
      copyValue: displayVitals?.resolution,
      icon: Monitor,
      id: 'display',
      label: 'Display Geometry',
      status: displayVitals?.resolution || 'Auto Detect',
      subtext: displayVitals?.dpi ? `${displayVitals.dpi} Density` : 'Standard Density',
      variant: 'default',
    },
    {
      copyValue: telemetry?.identity?.androidVersion ?? undefined,
      icon: Smartphone,
      id: 'os',
      label: 'Android OS & Patch',
      status: telemetry?.identity?.androidVersion
        ? `Android ${telemetry.identity.androidVersion}`
        : isAdb
          ? 'Android Core'
          : 'Unknown',
      subtext: telemetry?.security?.securityPatch
        ? `Patch: ${telemetry.security.securityPatch}`
        : 'Security level standard',
      variant: 'default',
    },
    {
      copyValue: telemetry?.identity?.arch ?? undefined,
      icon: Cpu,
      id: 'soc',
      label: 'SoC & Architecture',
      status: telemetry?.identity?.arch ? telemetry.identity.arch.toUpperCase() : 'ARM64 / Generic',
      subtext: telemetry?.identity?.manufacturer
        ? `${telemetry.identity.manufacturer} ${telemetry.identity.model || ''}`
        : 'Hardware target',
      variant: 'default',
    },
    {
      copyValue:
        telemetry?.security?.selinuxEnforcing !== null &&
        telemetry?.security?.selinuxEnforcing !== undefined
          ? telemetry.security.selinuxEnforcing
            ? 'Enforcing'
            : 'Permissive'
          : undefined,
      icon: telemetry?.security?.selinuxEnforcing === false ? ShieldAlert : ShieldCheck,
      id: 'selinux',
      label: 'SELinux Policy',
      status:
        telemetry?.security?.selinuxEnforcing !== null &&
        telemetry?.security?.selinuxEnforcing !== undefined
          ? telemetry.security.selinuxEnforcing
            ? 'Enforcing'
            : 'Permissive'
          : isAdb
            ? 'Enforcing'
            : 'Unknown',
      subtext:
        telemetry?.security?.selinuxEnforcing === false
          ? 'Permissive (Root/Debug)'
          : 'Strict Kernel Enforcement',
      variant: telemetry?.security?.selinuxEnforcing === false ? 'warning' : 'success',
    },
  ];

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Activity className="size-4.5 text-primary" />
            Device Vitals & Diagnostic Matrix
          </CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Real-time hardware telemetry and kernel security state parsed directly from ADB daemon
          </CardDescription>
        </div>

        <Button
          aria-label="Refresh vitals"
          className="size-8 p-0"
          disabled={isLoading || !isAdb}
          onClick={onRefresh}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
        </Button>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid @3xl:grid-cols-6 @lg:grid-cols-3 @xs:grid-cols-2 gap-3">
          {vitalsItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                className="group relative flex flex-col justify-between rounded-lg border border-border/80 bg-surface-raised/40 p-3 transition-colors hover:border-border hover:bg-surface-raised/80"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </span>
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground',
                      item.variant === 'success' && 'text-success',
                      item.variant === 'warning' && 'text-warning',
                      item.variant === 'destructive' && 'text-destructive',
                    )}
                  />
                </div>

                <div className="flex flex-col pt-1.5">
                  <span className="truncate font-semibold text-body text-foreground">
                    {item.status}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {item.subtext}
                  </span>
                </div>

                {item.copyValue ? (
                  <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <CopyButton value={item.copyValue} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
