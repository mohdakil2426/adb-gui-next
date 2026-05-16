import { Loader2, Pencil, RefreshCw, Smartphone } from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { getNickname } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { getStatusConfig } from '@/shared/utils/deviceStatus';

export interface DeviceData {
  serial: string;
  status: string;
}

interface ConnectedDevicesCardProps {
  className?: string;
  devices: DeviceData[];
  emptyText?: string;
  isLoading: boolean;
  isRefreshDisabled?: boolean;
  onEdit: (serial: string) => void;
  onRefresh: () => void;
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
      <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" />
          Connected Devices
        </CardTitle>
        <Button
          aria-label="Refresh device list"
          disabled={isLoading || isRefreshDisabled}
          onClick={onRefresh}
          size="icon"
          variant="ghost"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <EmptyState
            className="py-6"
            description={isLoading ? 'Looking for connected Android devices.' : emptyText}
            icon={Smartphone}
            title={isLoading ? 'Scanning for devices...' : 'No devices detected'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {devices.map((device) => {
              const displayName = getNickname(device.serial) ?? device.serial;
              const description = displayName === device.serial ? undefined : device.serial;
              const { label, variant, badgeClass } = getStatusConfig(device.status);

              return (
                <div
                  className="group flex items-center justify-between rounded-lg bg-muted p-3"
                  key={device.serial}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-semibold text-lg">{displayName}</span>
                      <Button
                        className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          onEdit(device.serial);
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                    {description ? (
                      <span className="truncate font-mono text-muted-foreground text-xs">
                        {description}
                      </span>
                    ) : null}
                  </div>

                  <Badge className={badgeClass} variant={variant}>
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
