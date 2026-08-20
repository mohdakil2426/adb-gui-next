import { useQuery } from '@tanstack/react-query';
import { Battery, BatteryCharging, Info, Square, Usb, Wifi } from 'lucide-react';
import { GetDeviceTelemetry } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/utils/cn';

interface TargetDeviceSelectorProps {
  activeSerials: Set<string>;
  disabled?: boolean | undefined;
  onClearAll: () => void;
  onSelectAll: () => void;
  onStopDevice?: ((serial: string) => void) | undefined;
  onToggleSerial: (serial: string) => void;
  selectedSerials: Set<string>;
}

function DeviceTile({
  activeSerials,
  device,
  disabled,
  isSelected,
  onStopDevice,
  onToggle,
}: {
  activeSerials: Set<string>;
  device: backend.Device;
  disabled: boolean;
  isSelected: boolean;
  onStopDevice?: ((serial: string) => void) | undefined;
  onToggle: () => void;
}) {
  const nicknames = useNicknameStore((state) => state.nicknames);
  const nickname = nicknames[device.serial];
  const displayName = nickname ?? device.serial;
  const isWireless = device.serial.includes(':');

  const isMirroring = activeSerials.has(device.serial) || activeSerials.has('*');

  // Lightweight telemetry fetch for battery & resolution (cached)
  const telemetryQuery = useQuery({
    queryKey: ['deviceTelemetry', device.serial],
    queryFn: () => GetDeviceTelemetry(device.serial),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const batteryPercent = telemetryQuery.data?.battery?.levelPct;
  const isCharging = telemetryQuery.data?.battery?.isCharging;
  const deviceModel = telemetryQuery.data?.identity?.model;

  return (
    <div
      aria-label={`Select device ${displayName}`}
      className={cn(
        'group relative flex cursor-pointer select-none flex-col justify-between gap-3 rounded-lg border p-3.5 transition-all duration-100 ease-standard',
        isSelected
          ? 'border-foreground/30 bg-surface-raised ring-1 ring-foreground/20'
          : 'border-border/80 bg-surface-raised/40 hover:border-border hover:bg-surface-raised',
        disabled && 'pointer-events-none opacity-50',
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Top row: Checkbox, Name, Status badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-6 shrink-0 items-center justify-center p-1">
            <Checkbox
              aria-label={`Select ${displayName}`}
              checked={isSelected}
              className="pointer-events-none size-4"
              tabIndex={-1}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-body text-foreground">{displayName}</span>
              {nickname ? (
                <span className="truncate font-mono text-caption text-muted-foreground">
                  ({device.serial})
                </span>
              ) : null}
            </div>
            {deviceModel ? (
              <span className="truncate text-caption text-muted-foreground">{deviceModel}</span>
            ) : null}
          </div>
        </div>

        {/* Live Streaming Badge / Stop button */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isMirroring ? (
            <Badge
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-caption text-emerald-400"
              variant="outline"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Mirroring
            </Badge>
          ) : null}

          {isMirroring && onStopDevice ? (
            <Button
              aria-label={`Stop mirror for ${displayName}`}
              className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onStopDevice(device.serial);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Square aria-hidden="true" className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bottom row: Connection Transport, Battery, Serial */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t pt-1 text-caption text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            {isWireless ? (
              <>
                <Wifi aria-hidden="true" className="size-3 text-sky-400" />
                <span>TCP 5555</span>
              </>
            ) : (
              <>
                <Usb aria-hidden="true" className="size-3 text-muted-foreground" />
                <span>USB Cable</span>
              </>
            )}
          </span>

          {batteryPercent !== undefined && batteryPercent !== null ? (
            <span className="inline-flex items-center gap-1 font-mono text-mono-sm">
              {isCharging ? (
                <BatteryCharging aria-hidden="true" className="size-3 text-emerald-400" />
              ) : (
                <Battery aria-hidden="true" className="size-3 text-muted-foreground" />
              )}
              <span>{batteryPercent}%</span>
            </span>
          ) : null}
        </div>

        <span className="font-mono text-mono-sm text-muted-foreground/80">
          {nickname ? 'Ready' : device.serial}
        </span>
      </div>
    </div>
  );
}

export function TargetDeviceSelector({
  activeSerials,
  disabled = false,
  onClearAll,
  onSelectAll,
  onStopDevice,
  onToggleSerial,
  selectedSerials,
}: TargetDeviceSelectorProps) {
  const devices = useDeviceStore((state) => state.devices);
  const adbDevices = devices.filter((d) => d.status === 'device');

  const allSelected =
    adbDevices.length > 0 && adbDevices.every((d) => selectedSerials.has(d.serial));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="font-semibold text-body text-foreground">Target Android Devices</Label>
          {adbDevices.length > 0 ? (
            <span className="text-caption text-muted-foreground">
              ({selectedSerials.size} of {adbDevices.length} selected)
            </span>
          ) : null}
        </div>

        {adbDevices.length > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              className="h-6 px-2 text-caption"
              disabled={disabled}
              onClick={allSelected ? onClearAll : onSelectAll}
              size="sm"
              type="button"
              variant="outline"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
          </div>
        ) : null}
      </div>

      {adbDevices.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5 text-caption text-muted-foreground">
          <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span>
            No active ADB devices detected. Plug in a device with USB Debugging enabled or connect
            via Wireless ADB.
          </span>
        </div>
      ) : (
        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-2.5">
          {adbDevices.map((device) => (
            <DeviceTile
              activeSerials={activeSerials}
              device={device}
              disabled={disabled}
              isSelected={selectedSerials.has(device.serial)}
              key={device.serial}
              onStopDevice={onStopDevice}
              onToggle={() => onToggleSerial(device.serial)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
