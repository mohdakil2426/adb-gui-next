import { useState } from 'react';
import { useDeviceStore } from '@/lib/deviceStore';
import { getNickname } from '@/lib/nicknameStore';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getStatusConfig } from '@/lib/deviceStatus';
import {
  ChevronDown,
  Pencil,
  RefreshCw,
  Loader2,
  Smartphone,
  MonitorSmartphone,
} from 'lucide-react';

interface DeviceSwitcherProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function DeviceSwitcher({ isRefreshing, onRefresh }: DeviceSwitcherProps) {
  const { devices, selectedSerial, setSelectedSerial } = useDeviceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nicknameVersion, setNicknameVersion] = useState(0);

  const selectedDevice = devices.find((d) => d.serial === selectedSerial);
  const displayName = selectedDevice
    ? getNickname(selectedDevice.serial) || selectedDevice.serial
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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 gap-1.5 rounded-full border border-border/50 px-2.5 text-xs font-medium',
                  'hover:bg-accent/80 transition-colors',
                  !selectedDevice && 'text-muted-foreground',
                )}
              >
                {selectedDevice ? (
                  <>
                    <span className="max-w-[120px] truncate">{displayName}</span>
                    <Badge
                      variant={statusConfig?.variant}
                      className={cn(
                        'text-[10px] px-1.5 py-0 pointer-events-none',
                        statusConfig?.badgeClass,
                      )}
                    >
                      {statusConfig?.label}
                    </Badge>
                  </>
                ) : (
                  <>
                    <MonitorSmartphone className="size-3.5 shrink-0" />
                    <span>No Device</span>
                  </>
                )}
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Device Switcher</TooltipContent>
        </Tooltip>

        <PopoverContent align="end" className="w-72 p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Smartphone className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Connected Devices</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>

          <Separator />

          {/* Device list */}
          <div className="max-h-[240px] overflow-y-auto p-1">
            {devices.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <MonitorSmartphone className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {isRefreshing ? 'Scanning for devices…' : 'No devices detected'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Ensure USB Debugging is enabled
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5" key={nicknameVersion}>
                {devices.map((device) => {
                  const nickname = getNickname(device.serial);
                  const name = nickname || device.serial;
                  const subtitle = nickname ? device.serial : undefined;
                  const config = getStatusConfig(device.status);
                  const isSelected = device.serial === selectedSerial;

                  return (
                    <div
                      key={device.serial}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'group/device relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm cursor-pointer',
                        'transition-colors hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isSelected && 'bg-accent',
                      )}
                      onClick={() => handleSelect(device.serial)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(device.serial);
                        }
                      }}
                    >
                      {/* Selection indicator */}
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          isSelected
                            ? 'bg-foreground'
                            : 'bg-transparent ring-2 ring-muted-foreground/30',
                        )}
                        aria-hidden
                      />

                      {/* Device info + edit */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium">{name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 shrink-0 opacity-0 group-hover/device:opacity-100 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(device.serial);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                        </div>
                        {subtitle && (
                          <div className="truncate text-xs text-muted-foreground font-mono">
                            {subtitle}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <Badge
                        variant={config.variant}
                        className={cn('shrink-0 text-[10px] px-1.5 py-0', config.badgeClass)}
                      >
                        {config.label}
                      </Badge>
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
        serial={editingSerial}
        onSaved={() => setNicknameVersion((v) => v + 1)}
      />
    </>
  );
}
