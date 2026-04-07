import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { backend } from '@/lib/desktop/models';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2, MonitorSmartphone, RefreshCw } from 'lucide-react';

interface AvdSwitcherProps {
  avds: backend.AvdSummary[];
  selectedAvdName: string | null;
  isRefreshing: boolean;
  onSelect: (name: string) => void;
  onRefresh: () => void;
}

function rootStateLabel(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'Rooted';
    case 'modified':
      return 'Modified';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Stock';
  }
}

export function AvdSwitcher({
  avds,
  selectedAvdName,
  isRefreshing,
  onSelect,
  onRefresh,
}: AvdSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedAvd = avds.find((a) => a.name === selectedAvdName) ?? null;

  const handleSelect = (name: string) => {
    onSelect(name);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 gap-1.5 rounded-full border border-border/50 px-2.5 text-xs font-medium',
                'transition-colors hover:bg-accent/80',
                !selectedAvd && 'text-muted-foreground',
              )}
            >
              {selectedAvd ? (
                <>
                  <span className="max-w-[160px] truncate">{selectedAvd.name}</span>
                  <Badge
                    className={cn(
                      'pointer-events-none rounded-full px-1.5 py-0 text-[10px]',
                      selectedAvd.isRunning
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border border-border bg-transparent text-muted-foreground',
                    )}
                  >
                    {selectedAvd.isRunning ? 'Running' : 'Stopped'}
                  </Badge>
                </>
              ) : (
                <>
                  <MonitorSmartphone className="size-3.5 shrink-0" />
                  <span>No AVD</span>
                </>
              )}
              <ChevronDown className="size-3 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Switch emulator</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <MonitorSmartphone className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Emulators</span>
            {avds.length > 0 && (
              <span className="text-xs text-muted-foreground">({avds.length})</span>
            )}
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

        {/* AVD list */}
        <div className="max-h-60 overflow-y-auto p-1">
          {avds.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MonitorSmartphone className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isRefreshing ? 'Scanning for AVDs…' : 'No AVDs found'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Create an AVD in Android Studio first
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {avds.map((avd) => {
                const isSelected = avd.name === selectedAvdName;

                return (
                  <div
                    key={avd.name}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                      'transition-colors hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => handleSelect(avd.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(avd.name);
                      }
                    }}
                  >
                    {/* Selection indicator — mirrors DeviceSwitcher */}
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        isSelected
                          ? 'bg-foreground'
                          : 'bg-transparent ring-2 ring-muted-foreground/30',
                      )}
                    />

                    {/* AVD info */}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{avd.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        API {avd.apiLevel ?? '?'}
                        {avd.abi ? ` · ${avd.abi}` : ''}
                        {avd.rootState !== 'stock' ? ` · ${rootStateLabel(avd.rootState)}` : ''}
                      </span>
                    </div>

                    {/* Running / Stopped badge */}
                    <Badge
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0 text-[10px]',
                        avd.isRunning
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border border-border bg-transparent text-muted-foreground',
                      )}
                    >
                      {avd.isRunning ? 'Running' : 'Stopped'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
