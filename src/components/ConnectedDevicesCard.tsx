import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, RefreshCw, Loader2, Pencil } from 'lucide-react';
import { getNickname } from '@/lib/nicknameStore';

export interface DeviceData {
  serial: string;
  status: string;
}

interface ConnectedDevicesCardProps {
  devices: DeviceData[];
  isLoading: boolean;
  onRefresh: () => void;
  onEdit: (serial: string) => void;
  emptyText?: string;
  className?: string;
  isRefreshDisabled?: boolean;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant; badgeClass: string }> =
  {
    device: {
      label: 'adb',
      variant: 'default',
      badgeClass: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
    },
    fastboot: {
      label: 'fastboot',
      variant: 'outline',
      badgeClass: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
    },
    bootloader: {
      label: 'bootloader',
      variant: 'outline',
      badgeClass: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
    },
    recovery: {
      label: 'recovery',
      variant: 'outline',
      badgeClass: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
    },
    sideload: {
      label: 'sideload',
      variant: 'outline',
      badgeClass: 'bg-violet-400/15 text-violet-400 border-violet-400/30',
    },
    unauthorized: {
      label: 'unauthorized',
      variant: 'destructive',
      badgeClass: 'bg-red-400/15 text-red-400 border-red-400/30',
    },
    offline: {
      label: 'offline',
      variant: 'destructive',
      badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    },
  };

function getStatusConfig(status: string): {
  label: string;
  variant: BadgeVariant;
  badgeClass: string;
} {
  return (
    STATUS_CONFIG[status.toLowerCase()] ?? {
      label: status.toLowerCase(),
      variant: 'outline',
      badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    }
  );
}

export function ConnectedDevicesCard({
  devices,
  isLoading,
  onRefresh,
  onEdit,
  emptyText = 'No device detected. Ensure USB Debugging is enabled.',
  className,
  isRefreshDisabled,
}: ConnectedDevicesCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Connected Devices
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading || isRefreshDisabled}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-muted-foreground">
            {isLoading ? 'Scanning for devices...' : emptyText}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {devices.map((device) => {
              const displayName = getNickname(device.serial) || device.serial;
              const description = displayName !== device.serial ? device.serial : undefined;
              const { label, variant, badgeClass } = getStatusConfig(device.status);

              return (
                <div
                  key={device.serial}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg group"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-lg">{displayName}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onEdit(device.serial)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                    {description && (
                      <span className="font-mono text-xs text-muted-foreground">{description}</span>
                    )}
                  </div>

                  <Badge variant={variant} className={badgeClass}>
                    {label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
