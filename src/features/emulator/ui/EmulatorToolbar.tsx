import {
  FolderOpen,
  PenTool,
  Play,
  ShieldCheck,
  Snowflake,
  Square,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { backend } from '@/desktop/models';
import { summarizeLaunchOptions } from '@/features/emulator/model/launchOptions';
import { AvdSwitcher } from '@/features/emulator/ui/AvdSwitcher';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface EmulatorToolbarProps {
  avds: backend.AvdSummary[];
  isBusy: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  /** Why Launch is unavailable, phrased as the fix. `null` when it is usable. */
  launchBlockedReason: string | null;
  launchOptions: backend.EmulatorLaunchOptions;
  onConfigureLaunch: () => void;
  onLaunch: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onSelectAvd: (name: string | null) => void;
  onStop: () => void;
  selectedAvd: backend.AvdSummary | null;
  selectedAvdName: string | null;
}

const EMPTY_VALUE = '—';

/** One label/value pair. Replaces the middot-separated run-on status line. */
function Fact({ label, mono, value }: { label: string; mono?: boolean; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn('truncate text-body text-foreground', mono && 'font-mono text-mono')}>
        {value}
      </span>
    </div>
  );
}

function StateBadges({ avd }: { avd: backend.AvdSummary }) {
  return (
    <>
      {avd.isRunning && avd.bootMode !== 'unknown' ? (
        <Badge variant={avd.bootMode === 'cold' ? 'info' : 'warning'}>
          {avd.bootMode === 'cold' ? (
            <Snowflake aria-hidden="true" />
          ) : (
            <TriangleAlert aria-hidden="true" />
          )}
          {avd.bootMode === 'cold' ? 'Cold boot' : 'Quick boot snapshot'}
        </Badge>
      ) : null}
      {avd.rootState === 'rooted' ? (
        <Badge variant="success">
          <ShieldCheck aria-hidden="true" />
          Rooted
        </Badge>
      ) : null}
      {avd.rootState === 'modified' ? (
        <Badge variant="warning">
          <PenTool aria-hidden="true" />
          Modified
        </Badge>
      ) : null}
      {avd.warnings.length > 0 ? (
        <Badge variant="neutral">
          <TriangleAlert aria-hidden="true" />
          <span className="numeric">{avd.warnings.length}</span>
          {avd.warnings.length === 1 ? 'warning' : 'warnings'}
        </Badge>
      ) : null}
    </>
  );
}

/**
 * AVD identity, state and the single launch control.
 *
 * The toolbar used to carry its own hard-coded Launch and Cold boot presets,
 * which discarded whatever the user had just configured in the Launch tab.
 * There is now one Launch button, it uses `launchOptions`, and it prints the
 * flags it is about to apply so the action is never silent.
 */
export function EmulatorToolbar({
  avds,
  isBusy,
  isLoading,
  isRefreshing,
  launchBlockedReason,
  launchOptions,
  onConfigureLaunch,
  onLaunch,
  onOpenFolder,
  onRefresh,
  onSelectAvd,
  onStop,
  selectedAvd,
  selectedAvdName,
}: EmulatorToolbarProps) {
  const activeOptions = summarizeLaunchOptions(launchOptions);

  return (
    <section
      aria-label="Emulator toolbar"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <AvdSwitcher
          avds={avds}
          isRefreshing={isLoading || isRefreshing}
          onRefresh={onRefresh}
          onSelect={onSelectAvd}
          selectedAvdName={selectedAvdName}
        />

        {selectedAvd ? (
          <>
            <span className="flex items-center gap-1.5 text-body">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  selectedAvd.isRunning ? 'bg-success' : 'bg-foreground-subtle',
                )}
              />
              <span className={selectedAvd.isRunning ? 'text-success' : 'text-muted-foreground'}>
                {selectedAvd.isRunning ? 'Running' : 'Stopped'}
              </span>
            </span>
            <StateBadges avd={selectedAvd} />
          </>
        ) : (
          <span className="text-body text-muted-foreground">
            {isLoading ? 'Scanning for AVDs…' : 'Select an AVD to begin.'}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {selectedAvd ? (
            <>
              {selectedAvd.isRunning ? (
                <Button
                  disabled={!selectedAvd.serial || isBusy}
                  onClick={onStop}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Square aria-hidden="true" />
                  Stop
                </Button>
              ) : (
                <Button
                  disabled={isBusy || launchBlockedReason !== null}
                  onClick={onLaunch}
                  size="sm"
                  type="button"
                >
                  <Play aria-hidden="true" />
                  Launch
                </Button>
              )}
              <Button
                disabled={isBusy}
                onClick={onOpenFolder}
                size="sm"
                type="button"
                variant="ghost"
              >
                <FolderOpen aria-hidden="true" />
                Folder
              </Button>
            </>
          ) : null}
          <RefreshButton
            aria-label="Refresh emulator roster"
            disabled={isBusy && !isRefreshing}
            isLoading={isLoading || isRefreshing}
            mode="icon"
            onClick={onRefresh}
            tooltip="Refresh emulators"
          />
        </div>
      </div>

      {selectedAvd ? (
        <>
          <dl className="grid @2xl:grid-cols-4 grid-cols-2 gap-x-4 gap-y-2 border-border border-t pt-3">
            <Fact label="Target" value={selectedAvd.target ?? EMPTY_VALUE} />
            <Fact
              label="API level"
              value={
                selectedAvd.apiLevel === null ? (
                  EMPTY_VALUE
                ) : (
                  <span className="numeric">API {selectedAvd.apiLevel}</span>
                )
              }
            />
            <Fact label="ABI" value={selectedAvd.abi ?? EMPTY_VALUE} />
            <Fact
              label={selectedAvd.isRunning ? 'Serial' : 'Device profile'}
              mono={selectedAvd.isRunning}
              value={
                selectedAvd.isRunning
                  ? (selectedAvd.serial ?? EMPTY_VALUE)
                  : (selectedAvd.deviceName ?? EMPTY_VALUE)
              }
            />
          </dl>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            {launchBlockedReason ? (
              <>
                <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
                <span className="text-foreground">{launchBlockedReason}</span>
              </>
            ) : (
              <>
                <span>Launch options:</span>
                <span className="text-foreground">
                  {activeOptions.length > 0 ? activeOptions.join(', ') : 'Defaults'}
                </span>
              </>
            )}
            <Button
              className="h-auto p-0 text-caption"
              onClick={onConfigureLaunch}
              type="button"
              variant="link"
            >
              {launchBlockedReason ? 'Open Launch tab' : 'Configure'}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
