import { FolderOpen, PenTool, Play, ShieldCheck, Snowflake, Square } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { AvdSwitcher } from '@/features/emulator/ui/AvdSwitcher';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface EmulatorToolbarProps {
  avds: backend.AvdSummary[];
  isBusy: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onColdBoot: () => void;
  onLaunch: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onSelectAvd: (name: string | null) => void;
  onStop: () => void;
  selectedAvd: backend.AvdSummary | null;
  selectedAvdName: string | null;
}

export function EmulatorToolbar({
  avds,
  isBusy,
  isLoading,
  isRefreshing,
  onColdBoot,
  onLaunch,
  onOpenFolder,
  onRefresh,
  onSelectAvd,
  onStop,
  selectedAvd,
  selectedAvdName,
}: EmulatorToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <AvdSwitcher
            avds={avds}
            isRefreshing={isLoading || isRefreshing}
            onRefresh={onRefresh}
            onSelect={onSelectAvd}
            selectedAvdName={selectedAvdName}
          />
          {selectedAvd?.warnings && selectedAvd.warnings.length > 0 ? (
            <Badge className="rounded-full text-xs" variant="warning">
              {selectedAvd.warnings.length}{' '}
              {selectedAvd.warnings.length === 1 ? 'warning' : 'warnings'}
            </Badge>
          ) : null}
        </div>

        {selectedAvd ? (
          <div className="flex flex-wrap items-center gap-2 pl-0.5">
            <p className="text-muted-foreground text-xs">
              {selectedAvd.isRunning ? (
                <span className="text-success">
                  ● Running
                  {selectedAvd.serial ? ` · ${selectedAvd.serial}` : ''}
                </span>
              ) : (
                <span>● Stopped</span>
              )}
              {' · '}
              {selectedAvd.target ?? 'Unknown target'} · API {selectedAvd.apiLevel ?? '?'}
              {selectedAvd.abi ? ` · ${selectedAvd.abi}` : ''}
              {selectedAvd.deviceName ? ` · ${selectedAvd.deviceName}` : ''}
            </p>
            {selectedAvd.isRunning && selectedAvd.bootMode !== 'unknown' ? (
              <Badge
                className="rounded-full text-xs"
                variant={selectedAvd.bootMode === 'cold' ? 'default' : 'warning'}
              >
                {selectedAvd.bootMode === 'cold' ? '❄ Cold Boot' : '⚠ Normal Boot'}
              </Badge>
            ) : null}
            {selectedAvd.rootState === 'rooted' && (
              <Badge className="gap-1 rounded-full bg-success/15 text-success text-xs">
                <ShieldCheck className="size-3" />
                Rooted
              </Badge>
            )}
            {selectedAvd.rootState === 'modified' && (
              <Badge className="gap-1 rounded-full bg-warning/15 text-warning text-xs">
                <PenTool className="size-3" />
                Modified
              </Badge>
            )}
          </div>
        ) : (
          <p className="pl-0.5 text-muted-foreground text-xs">
            {isLoading ? 'Scanning for AVDs…' : 'Select an AVD to begin.'}
          </p>
        )}
      </div>

      {selectedAvd ? (
        <div className="flex flex-wrap gap-1.5 sm:shrink-0">
          {selectedAvd.isRunning ? (
            <Button
              disabled={!selectedAvd.serial || isBusy}
              onClick={onStop}
              size="sm"
              variant="outline"
            >
              <Square data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button disabled={isBusy} onClick={onLaunch} size="sm">
              <Play data-icon="inline-start" />
              Launch
            </Button>
          )}
          <Button disabled={isBusy} onClick={onColdBoot} size="sm" variant="outline">
            <Snowflake data-icon="inline-start" />
            Cold boot
          </Button>
          <Button disabled={isBusy} onClick={onOpenFolder} size="sm" variant="ghost">
            <FolderOpen data-icon="inline-start" />
            Folder
          </Button>
        </div>
      ) : null}
    </div>
  );
}
