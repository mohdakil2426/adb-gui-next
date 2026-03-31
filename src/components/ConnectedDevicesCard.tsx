import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, RefreshCw, Loader2, Pencil } from 'lucide-react';
import { getNickname } from '@/lib/nicknameStore';
import { getStatusConfig } from '@/lib/deviceStatus';

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
