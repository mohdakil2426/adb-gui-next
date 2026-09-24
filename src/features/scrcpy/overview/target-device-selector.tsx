import { useQuery } from "@tanstack/react-query";
import { Battery, BatteryCharging, Info, Square, Usb, Wifi } from "lucide-react";

import { GetDeviceTelemetry } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useNicknameStore } from "@/shared/stores/nickname-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";

// Empty state handled across UI when data?.length === 0

interface TargetDeviceSelectorProps {
  activeSerials: Set<string>;
  disabled?: boolean | undefined;
  onClearAll: () => void;
  onSelectAll: () => void;
  onStopDevice?: ((serial: string) => void) | undefined;
  onToggleSerial: (serial: string) => void;
  selectedSerials: Set<string>;
}

const DeviceTileBottomRow = ({
  batteryPercent,
  isCharging,
  isWireless,
  nickname,
  serial,
}: {
  batteryPercent: number | null | undefined;
  isCharging: boolean | undefined;
  isWireless: boolean;
  nickname: string | undefined;
  serial: string;
}) => (
  <div className="border-border/40 text-caption text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-1">
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1">
        {isWireless ? (
          <>
            <Wifi aria-hidden="true" className="text-info size-3" />
            <span>TCP 5555</span>
          </>
        ) : (
          <>
            <Usb aria-hidden="true" className="text-muted-foreground size-3" />
            <span>USB Cable</span>
          </>
        )}
      </span>

      {batteryPercent !== undefined && batteryPercent !== null ? (
        <span className="text-mono-sm inline-flex items-center gap-1 font-mono">
          {isCharging ? (
            <BatteryCharging aria-hidden="true" className="text-success size-3" />
          ) : (
            <Battery aria-hidden="true" className="text-muted-foreground size-3" />
          )}
          <span>{batteryPercent}%</span>
        </span>
      ) : null}
    </div>

    <span className="text-mono-sm text-muted-foreground/80 font-mono">
      {nickname ? "Ready" : serial}
    </span>
  </div>
);

const DeviceTile = ({
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
}) => {
  const nicknames = useNicknameStore((state) => state.nicknames);
  const nickname = nicknames[device.serial];
  const displayName = nickname ?? device.serial;
  const isWireless = device.serial.includes(":");

  const isMirroring = activeSerials.has(device.serial) || activeSerials.has("*");

  // Lightweight telemetry fetch for battery & resolution (cached)
  const telemetryQuery = useQuery({
    queryFn: () => GetDeviceTelemetry(device.serial),
    queryKey: ["deviceTelemetry", device.serial],
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const batteryPercent = telemetryQuery.data?.battery?.levelPct;
  const isCharging = telemetryQuery.data?.battery?.isCharging;
  const deviceModel = telemetryQuery.data?.identity?.model;

  return (
    <button
      aria-label={`Select device ${displayName}`}
      className={cn(
        "group ease-standard relative flex w-full cursor-pointer flex-col justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors duration-100 select-none",
        isSelected
          ? "border-foreground/30 bg-surface-raised ring-foreground/20 ring-1"
          : "border-border/80 bg-surface-raised/40 hover:border-border hover:bg-surface-raised",
        disabled && "pointer-events-none opacity-50"
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
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
              <span className="text-body text-foreground truncate font-medium">{displayName}</span>
              {nickname ? (
                <span className="text-caption text-muted-foreground truncate font-mono">
                  ({device.serial})
                </span>
              ) : null}
            </div>
            {deviceModel ? (
              <span className="text-caption text-muted-foreground truncate">{deviceModel}</span>
            ) : null}
          </div>
        </div>

        {/* Live Streaming Badge / Stop button */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isMirroring ? (
            <Badge
              className="text-caption border-success/30 bg-success/10 text-success gap-1 px-2 py-0.5"
              variant="outline"
            >
              <span className="bg-success size-1.5 animate-pulse rounded-full" />
              Mirroring
            </Badge>
          ) : null}

          {isMirroring && onStopDevice ? (
            <Button
              aria-label={`Stop mirror for ${displayName}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-6"
              onClick={(e) => {
                e.stopPropagation();
                onStopDevice(device.serial);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Square aria-hidden="true" className="size-3" data-icon="inline-start" />
            </Button>
          ) : null}
        </div>
      </div>

      <DeviceTileBottomRow
        batteryPercent={batteryPercent}
        isCharging={isCharging}
        isWireless={isWireless}
        nickname={nickname}
        serial={device.serial}
      />
    </button>
  );
};

export const TargetDeviceSelector = ({
  activeSerials,
  disabled,
  onClearAll,
  onSelectAll,
  onStopDevice,
  onToggleSerial,
  selectedSerials,
}: TargetDeviceSelectorProps) => {
  const devices = useDeviceStore((state) => state.devices);
  const adbDevices = devices.filter((d) => d.status === "device");

  const allSelected =
    adbDevices.length > 0 && adbDevices.every((d) => selectedSerials.has(d.serial));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-body text-foreground font-semibold">Target Android Devices</Label>
          {adbDevices.length > 0 ? (
            <span className="text-caption text-muted-foreground">
              ({selectedSerials.size} of {adbDevices.length} selected)
            </span>
          ) : null}
        </div>

        {adbDevices.length > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              className="text-caption h-6 px-2"
              disabled={disabled}
              onClick={allSelected ? onClearAll : onSelectAll}
              size="sm"
              type="button"
              variant="outline"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
        ) : null}
      </div>

      {adbDevices.length === 0 ? (
        <div className="border-border/80 bg-surface-raised/40 text-caption text-muted-foreground flex items-center gap-2.5 rounded-lg border p-3.5">
          <Info aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span>
            No active ADB devices detected. Plug in a device with USB Debugging enabled or connect
            via Wireless ADB.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
          {adbDevices.map((device) => (
            <DeviceTile
              activeSerials={activeSerials}
              device={device}
              disabled={Boolean(disabled)}
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
};
