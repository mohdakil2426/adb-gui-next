import { ChevronDown, MonitorSmartphone, Pencil, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Separator } from '@/shared/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { getStatusConfig } from '@/shared/utils/deviceStatus';

interface DeviceSwitcherProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function DeviceSwitcher({ isRefreshing, onRefresh }: DeviceSwitcherProps) {
  const { devices, selectedSerial, setSelectedSerial } = useDeviceStore(
    useShallow((state) => ({
      devices: state.devices,
      selectedSerial: state.selectedSerial,
      setSelectedSerial: state.setSelectedSerial,
    })),
  );
  // One in-memory subscription — no localStorage read/parse per device per render.
  const nicknames = useNicknameStore((state) => state.nicknames);
  const [isOpen, setIsOpen] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const selectedDevice = devices.find((d) => d.serial === selectedSerial);
  const displayName = selectedDevice
    ? (nicknames[selectedDevice.serial] ?? selectedDevice.serial)
    : null;
  const statusConfig = selectedDevice ? getStatusConfig(selectedDevice.status) : null;

  const handleSelect = (serial: string) => {
    setSelectedSerial(serial);
    setIsOpen(false);
  };

  const handleEdit = (serial: string) => {
    setEditingSerial(serial);
    setIsEditing(true);
  };

  return (
    <>
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                className={cn(
                  // Squared to match every other header control (h-8, rounded-md).
                  // This was a rounded-full h-7 pill — the only one in the chrome.
                  'h-8 gap-1.5 rounded-md border border-border px-2.5 font-medium text-label',
                  !selectedDevice && 'text-muted-foreground',
                )}
                size="sm"
                variant="ghost"
              >
                {selectedDevice ? (
                  <>
                    <span className="max-w-[120px] truncate">{displayName}</span>
                    <Badge
                      className={cn(
                        'pointer-events-none px-1.5 py-0 text-caption',
                        statusConfig?.badgeClass,
                      )}
                      variant={statusConfig?.variant}
                    >
                      {statusConfig?.label}
                    </Badge>
                  </>
                ) : (
                  <>
                    <MonitorSmartphone
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                      data-icon="inline-start"
                    />
                    <span>No Device</span>
                  </>
                )}
                <ChevronDown
                  aria-hidden="true"
                  className="size-3 shrink-0 opacity-60"
                  data-icon="inline-start"
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Device Switcher</TooltipContent>
        </Tooltip>

        <PopoverContent align="start" className="w-72 p-0" collisionPadding={16}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Smartphone aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">Connected Devices</span>
            </div>
            <RefreshButton
              aria-label="Refresh Devices"
              className="size-7"
              isLoading={isRefreshing}
              mode="icon"
              onClick={onRefresh}
            />
          </div>

          <Separator />

          {/* Device list */}
          <div className="max-h-[240px] overflow-y-auto p-1">
            {devices.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <MonitorSmartphone
                  aria-hidden="true"
                  className="mx-auto size-8 text-muted-foreground/40"
                />
                <p className="mt-2 text-muted-foreground text-sm">
                  {isRefreshing ? 'Scanning for devices…' : 'No devices detected'}
                </p>
                <p className="mt-1 text-label text-muted-foreground">
                  Ensure USB Debugging is enabled
                </p>
              </div>
            ) : (
              <div aria-label="Connected devices" className="flex flex-col gap-0.5" role="group">
                {devices.map((device) => {
                  const nickname = nicknames[device.serial] ?? null;
                  const name = nickname ?? device.serial;
                  const subtitle = nickname ? device.serial : undefined;
                  const config = getStatusConfig(device.status);
                  const isSelected = device.serial === selectedSerial;

                  return (
                    // Edit stays a sibling of the row button — a button may not nest a button.
                    <div className="group/device relative" key={device.serial}>
                      <button
                        aria-current={isSelected}
                        className={cn(
                          'relative flex w-full cursor-pointer items-center gap-2.5 rounded-md py-2 pr-9 pl-2.5 text-left text-sm',
                          'transition-colors hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          isSelected && 'bg-accent',
                        )}
                        onClick={() => {
                          handleSelect(device.serial);
                        }}
                        type="button"
                      >
                        {/* Selection indicator */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            isSelected
                              ? 'bg-foreground'
                              : 'bg-transparent ring-2 ring-muted-foreground/30',
                          )}
                        />

                        {/* Device info */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{name}</span>
                          {subtitle ? (
                            <span className="block truncate font-mono text-muted-foreground text-xs">
                              {subtitle}
                            </span>
                          ) : null}
                        </span>

                        {/* Status badge */}
                        <Badge
                          className={cn(
                            'pointer-events-none shrink-0 px-1.5 py-0 text-caption',
                            config.badgeClass,
                          )}
                          variant={config.variant}
                        >
                          {config.label}
                        </Badge>
                      </button>

                      <Button
                        aria-label={`Edit ${name} Nickname`}
                        className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/device:opacity-100 group-hover/device:opacity-100"
                        onClick={() => {
                          handleEdit(device.serial);
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-3" data-icon="inline-start" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        onSaved={() => {
          setIsEditing(false);
        }}
        serial={editingSerial}
      />
    </>
  );
}
