import { Info, Smartphone, Square } from 'lucide-react';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/utils/cn';

interface ScrcpyDeviceSelectorProps {
  activeSerials?: Set<string> | undefined;
  disabled?: boolean | undefined;
  onClearAll: () => void;
  onSelectAll: () => void;
  onStopDevice?: ((serial: string) => void) | undefined;
  onToggleSerial: (serial: string) => void;
  selectedSerials: Set<string>;
}

export function ScrcpyDeviceSelector({
  activeSerials,
  disabled = false,
  onClearAll,
  onSelectAll,
  onStopDevice,
  onToggleSerial,
  selectedSerials,
}: ScrcpyDeviceSelectorProps) {
  const devices = useDeviceStore((state) => state.devices);
  const nicknames = useNicknameStore((state) => state.nicknames);

  // Scrcpy requires active ADB devices (not fastboot / unauthorized / offline).
  const adbDevices = devices.filter((d) => d.status === 'device');

  const allSelected =
    adbDevices.length > 0 && adbDevices.every((d) => selectedSerials.has(d.serial));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="font-medium text-body">Target devices</Label>
          {adbDevices.length > 0 ? (
            <span className="text-caption text-muted-foreground">
              ({selectedSerials.size} of {adbDevices.length} selected)
            </span>
          ) : null}
        </div>
        {adbDevices.length > 1 ? (
          <Button
            className="h-6 px-2.5 font-medium text-caption"
            disabled={disabled}
            onClick={allSelected ? onClearAll : onSelectAll}
            size="sm"
            type="button"
            variant="outline"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </Button>
        ) : null}
      </div>

      {adbDevices.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised p-3 text-caption text-muted-foreground">
          <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span>No active ADB devices detected. Connect a device and enable USB debugging.</span>
        </div>
      ) : (
        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-2">
          {adbDevices.map((device) => {
            const isSelected = selectedSerials.has(device.serial);
            const isMirroring = activeSerials
              ? activeSerials.has(device.serial) || activeSerials.has('*')
              : false;
            const displayName = nicknames[device.serial] ?? device.serial;

            return (
              <div
                className={cn(
                  'flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors duration-90 ease-standard',
                  isSelected
                    ? 'border-primary/50 bg-accent/40 text-foreground'
                    : 'border-border bg-surface-raised text-muted-foreground hover:bg-accent/20 hover:text-foreground',
                  disabled && 'pointer-events-none opacity-50',
                )}
                key={device.serial}
                onClick={() => onToggleSerial(device.serial)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleSerial(device.serial);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Checkbox checked={isSelected} className="pointer-events-none" tabIndex={-1} />
                  <Smartphone
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-body text-foreground">{displayName}</p>
                    <p className="truncate font-mono text-mono-sm text-muted-foreground">
                      {device.serial}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isMirroring ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-caption text-emerald-500">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Mirroring
                    </span>
                  ) : null}

                  {isMirroring && onStopDevice ? (
                    <Button
                      className="h-7 shrink-0 gap-1 px-2 text-caption text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopDevice(device.serial);
                      }}
                      size="sm"
                      title={`Stop scrcpy on ${displayName}`}
                      type="button"
                      variant="ghost"
                    >
                      <Square aria-hidden="true" className="size-3.5" />
                      Stop
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
