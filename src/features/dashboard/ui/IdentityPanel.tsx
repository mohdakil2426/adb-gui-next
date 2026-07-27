import { Clock, Smartphone, Wifi } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { isWirelessSerial } from '@/features/dashboard/model/deviceMode';
import { CopyButton } from '@/shared/components/CopyButton';
import { useNickname } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { Skeleton } from '@/shared/ui/skeleton';
import { getStatusConfig } from '@/shared/utils/deviceStatus';
import { EMPTY_VALUE, formatDuration } from '@/shared/utils/format';

interface IdentityPanelProps {
  device: backend.Device;
  isLoading: boolean;
  telemetry: backend.DeviceTelemetry | null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="truncate font-medium text-body">{value}</span>
    </div>
  );
}

/** Who this device is — the one card that answers "am I pointed at the right phone?". */
export function IdentityPanel({ device, isLoading, telemetry }: IdentityPanelProps) {
  const nickname = useNickname(device.serial);
  const identity = telemetry?.identity;
  const status = getStatusConfig(device.status);

  const headline = nickname ?? identity?.deviceName ?? identity?.model ?? device.serial;
  const vendorLine = [identity?.brand, identity?.codename].filter(Boolean).join(' · ');
  const androidLine = [
    identity?.androidVersion ? `Android ${identity.androidVersion}` : null,
    identity?.sdkInt ? `API ${identity.sdkInt}` : null,
    identity?.arch,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Card className="@container gap-3 rounded-lg border-border bg-surface py-4 shadow-none">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Smartphone aria-hidden="true" className="size-5" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate font-semibold text-title">{headline}</h2>
              <Badge className={status.badgeClass} variant={status.variant}>
                {status.label}
              </Badge>
              {isWirelessSerial(device.serial) ? (
                <Badge className="gap-1" variant="info">
                  <Wifi aria-hidden="true" />
                  wireless
                </Badge>
              ) : null}
            </div>

            {isLoading && !vendorLine ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <p className="truncate text-body text-muted-foreground">
                {vendorLine || 'Reading device properties…'}
              </p>
            )}

            <div className="-ml-1 flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-mono text-muted-foreground">
                {device.serial}
              </span>
              <CopyButton className="size-6" label="Serial" value={device.serial} />
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid @lg:grid-cols-4 grid-cols-2 gap-x-4 gap-y-3">
          <Fact label="Platform" value={androidLine || EMPTY_VALUE} />
          <Fact label="Build" value={identity?.buildId ?? EMPTY_VALUE} />
          <Fact label="Model" value={identity?.model ?? EMPTY_VALUE} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-caption text-muted-foreground uppercase tracking-wide">
              Uptime
            </span>
            <span className="numeric flex items-center gap-1.5 truncate font-medium text-body">
              <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
              {telemetry ? formatDuration(telemetry.uptimeSeconds) : EMPTY_VALUE}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
