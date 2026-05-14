import {
  ChevronDown,
  Loader2,
  MonitorSmartphone,
  Pencil,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { getNickname } from '@/shared/stores/nicknameStore';
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
  const [isOpen, setIsOpen] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nicknameVersion, setNicknameVersion] = useState(0);

  const selectedDevice = devices.find((d) => d.serial === selectedSerial);
  const displayName = selectedDevice
    ? (getNickname(selectedDevice.serial) ?? selectedDevice.serial)
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
                  'h-7 gap-1.5 rounded-full border border-border/50 px-2.5 font-medium text-xs',
                  'transition-colors hover:bg-accent/80',
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
                        'pointer-events-none px-1.5 py-0 text-[10px]',
                        statusConfig?.badgeClass,
                      )}
                      variant={statusConfig?.variant}
                    >
                      {statusConfig?.label}
                    </Badge>
                  </>
                ) : (
                  <>
                    <MonitorSmartphone aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>No Device</span>
                  </>
                )}
                <ChevronDown aria-hidden="true" className="size-3 shrink-0 opacity-60" />
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
            <Button
              aria-label="Refresh Devices"
              className="size-7"
              disabled={isRefreshing}
              onClick={onRefresh}
              size="icon"
              variant="ghost"
            >
              {isRefreshing ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-3.5" />
              )}
            </Button>
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
                <p className="mt-1 text-muted-foreground/60 text-xs">
                  Ensure USB Debugging is enabled
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5" key={nicknameVersion}>
                {devices.map((device) => {
                  const nickname = getNickname(device.serial);
                  const name = nickname ?? device.serial;
                  const subtitle = nickname ? device.serial : undefined;
                  const config = getStatusConfig(device.status);
                  const isSelected = device.serial === selectedSerial;

                  return (
                    <button
                      className={cn(
                        'group/device relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                        'transition-colors hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isSelected && 'bg-accent',
                      )}
                      key={device.serial}
                      onClick={() => {
                        handleSelect(device.serial);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(device.serial);
                        }
                      }}
                      tabIndex={0}
                      type="button"
                    >
                      {/* Selection indicator */}
                      <span
                        aria-hidden
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          isSelected
                            ? 'bg-foreground'
                            : 'bg-transparent ring-2 ring-muted-foreground/30',
                        )}
                      />

                      {/* Device info + edit */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium">{name}</span>
                          <Button
                            aria-label={`Edit ${name} Nickname`}
                            className="size-5 shrink-0 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover/device:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(device.serial);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <Pencil aria-hidden="true" className="size-3" />
                          </Button>
                        </div>
                        {subtitle ? (
                          <div className="truncate font-mono text-muted-foreground text-xs">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>

                      {/* Status badge */}
                      <Badge
                        className={cn('shrink-0 px-1.5 py-0 text-[10px]', config.badgeClass)}
                        variant={config.variant}
                      >
                        {config.label}
                      </Badge>
                    </button>
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
          setNicknameVersion((v) => v + 1);
        }}
        serial={editingSerial}
      />
    </>
  );
}
