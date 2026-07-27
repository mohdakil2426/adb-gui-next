import { ChevronDown, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import type { backend } from '@/desktop/models';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Separator } from '@/shared/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

interface AvdSwitcherProps {
  avds: backend.AvdSummary[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelect: (name: string) => void;
  selectedAvdName: string | null;
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

/**
 * AVD picker. The trigger carries the name only — run state, boot mode and
 * device facts belong to the toolbar next to it, and printing them twice made
 * "Stopped" ambiguous on screen and to assistive tech.
 */
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
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              className={cn('gap-1.5', !selectedAvd && 'text-muted-foreground')}
              size="sm"
              type="button"
              variant="outline"
            >
              <MonitorSmartphone aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="max-w-40 truncate">{selectedAvd?.name ?? 'No AVD'}</span>
              <ChevronDown aria-hidden="true" className="size-3 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Switch emulator</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <MonitorSmartphone aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="text-caption text-muted-foreground uppercase tracking-wide">
              Emulators
            </span>
            {avds.length > 0 ? (
              <span className="numeric text-caption text-muted-foreground">({avds.length})</span>
            ) : null}
          </div>
          <RefreshButton
            aria-label="Refresh emulators"
            isLoading={isRefreshing}
            mode="icon"
            onClick={onRefresh}
          />
        </div>

        <Separator />

        <div className="max-h-60 overflow-y-auto p-1">
          {avds.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MonitorSmartphone
                aria-hidden="true"
                className="mx-auto size-8 text-foreground-subtle"
              />
              <p className="mt-2 text-body text-muted-foreground">
                {isRefreshing ? 'Scanning for AVDs…' : 'No AVDs found'}
              </p>
              <p className="mt-1 text-caption text-foreground-subtle">
                Create one in Android Studio → Device Manager, then refresh.
              </p>
            </div>
          ) : (
            <div
              aria-label="Android virtual devices"
              className="flex flex-col gap-0.5"
              role="group"
            >
              {avds.map((avd) => {
                const isSelected = avd.name === selectedAvdName;

                return (
                  <button
                    aria-current={isSelected}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body',
                      'transition-colors duration-90 ease-standard hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isSelected && 'bg-accent',
                    )}
                    key={avd.name}
                    onClick={() => {
                      handleSelect(avd.name);
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        avd.isRunning ? 'bg-success' : 'bg-foreground-subtle',
                      )}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{avd.name}</span>
                      <span className="numeric block truncate text-caption text-muted-foreground">
                        API {avd.apiLevel ?? '—'}
                        {avd.abi ? ` · ${avd.abi}` : ''}
                        {avd.rootState === 'stock' ? '' : ` · ${rootStateLabel(avd.rootState)}`}
                      </span>
                    </span>

                    <Badge className="shrink-0" variant={avd.isRunning ? 'success' : 'neutral'}>
                      {avd.isRunning ? 'Running' : 'Stopped'}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
