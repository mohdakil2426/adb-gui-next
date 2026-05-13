import {
  Battery,
  Building,
  Code,
  Cpu,
  Database,
  Hash,
  Info,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Tag,
  Wifi,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { InfoItem } from '@/features/dashboard/ui/InfoItem';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function DeviceInfoCard({
  deviceInfo,
  isRefreshingInfo,
  onRefresh,
  selectedSerial,
}: {
  deviceInfo: backend.DeviceInfo | null;
  isRefreshingInfo: boolean;
  onRefresh: () => void;
  selectedSerial: string | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <CardTitle className="flex items-center gap-2">
          <Info className="size-5" />
          Device Info
        </CardTitle>
        <Button
          disabled={isRefreshingInfo || !selectedSerial}
          onClick={onRefresh}
          variant="default"
        >
          {isRefreshingInfo ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Refresh Info
        </Button>
      </CardHeader>
      <CardContent>
        {selectedSerial ? (
          deviceInfo ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem
                copyable
                icon={<Building className="size-4" />}
                label="Brand"
                value={deviceInfo.brand}
              />
              <InfoItem
                copyable
                icon={<Tag className="size-4" />}
                label="Device Name"
                value={deviceInfo.deviceName}
              />
              <InfoItem
                copyable
                icon={<Code className="size-4" />}
                label="Codename"
                value={deviceInfo.codename}
              />
              <InfoItem
                copyable
                icon={<Smartphone className="size-4" />}
                label="Model"
                value={deviceInfo.model}
              />
              <InfoItem
                copyable
                icon={<Hash className="size-4" />}
                label="Serial Number"
                value={deviceInfo.serial}
              />
              <InfoItem
                copyable
                icon={<Server className="size-4" />}
                label="Build Number"
                value={deviceInfo.buildNumber}
              />
              <InfoItem
                copyable
                icon={<Info className="size-4" />}
                label="Android Version"
                value={deviceInfo.androidVersion}
              />
              <InfoItem
                copyable
                icon={<Battery className="size-4" />}
                label="Battery"
                value={deviceInfo.batteryLevel}
              />
              <InfoItem
                copyable
                icon={<Cpu className="size-4" />}
                label="Total RAM"
                value={deviceInfo.ramTotal}
              />
              <InfoItem
                copyable
                icon={<Database className="size-4" />}
                label="Internal Storage"
                value={deviceInfo.storageInfo}
              />
              <InfoItem
                copyable
                icon={<Wifi className="size-4" />}
                label="IP Address"
                value={deviceInfo.ipAddress}
              />
              <InfoItem
                copyable
                icon={<ShieldCheck className="size-4" />}
                label="Root Status"
                value={deviceInfo.rootStatus}
                valueClassName={
                  deviceInfo.rootStatus === 'Yes'
                    ? 'text-success font-bold'
                    : 'text-muted-foreground'
                }
              />
            </div>
          ) : (
            <p className="text-muted-foreground">Click "Refresh Info" to load data.</p>
          )
        ) : (
          <p className="text-muted-foreground">Connect a device to see info.</p>
        )}
      </CardContent>
    </Card>
  );
}
