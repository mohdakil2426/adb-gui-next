import { Cpu, Edit3, Hash, RefreshCw, Server, Smartphone, Terminal, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { RestartAdbServer } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { CopyButton } from '@/shared/components/CopyButton';
import { useNickname } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

interface UtilitiesCockpitHeroProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  hostVersions: backend.HostToolVersions | null;
  isLoading?: boolean;
  onEditNickname: () => void;
  onRefresh: () => void;
}

interface SpecItemProps {
  copyValue?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltip?: string;
  value: React.ReactNode;
}

function SpecItem({ copyValue, icon: Icon, label, tooltip, value }: SpecItemProps) {
  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-surface-raised/40 p-2.5 transition-colors hover:bg-surface-raised/80">
      <div className="flex items-center justify-between gap-1 text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 text-muted-foreground/80" />
          <span className="truncate font-medium text-caption uppercase tracking-wider">
            {label}
          </span>
        </div>
        {copyValue ? (
          <CopyButton
            className="size-5 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            label={label}
            value={copyValue}
          />
        ) : null}
      </div>

      <div className="mt-1.5 truncate font-medium text-body text-foreground">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{value}</span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export function UtilitiesCockpitHero({
  deviceMode,
  deviceSerial,
  hostVersions,
  isLoading,
  onEditNickname,
  onRefresh,
}: UtilitiesCockpitHeroProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const nickname = useNickname(deviceSerial);

  const handleRestart = useCallback(async () => {
    setIsRestarting(true);
    try {
      await RestartAdbServer();
      handleSuccess('ADB Server', 'ADB server restarted successfully');
      onRefresh();
    } catch (error) {
      handleError('Restart ADB Server', error);
    } finally {
      setIsRestarting(false);
    }
  }, [onRefresh]);

  // Extract ADB version number (e.g. "1.0.41" from "Android Debug Bridge version 1.0.41")
  const adbVersionMatch = hostVersions?.adb?.match(/version\s+([0-9.]+)/i);
  const adbVersion = adbVersionMatch
    ? `v${adbVersionMatch[1]}`
    : hostVersions?.adb
      ? 'Detected'
      : 'Searching…';

  // Extract Fastboot version number
  const fastbootVersionMatch = hostVersions?.fastboot?.match(/version\s+([0-9.]+)/i);
  const fastbootVersion = fastbootVersionMatch
    ? `v${fastbootVersionMatch[1]}`
    : hostVersions?.fastboot
      ? 'Detected'
      : 'Searching…';

  return (
    <Card className="@container rounded-xl border border-border bg-surface p-4.5 shadow-none transition-colors duration-150">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Screen-reader status announcement region */}
        <div aria-live="polite" className="sr-only" role="status">
          {isLoading
            ? 'Refreshing utilities telemetry…'
            : isRestarting
              ? 'Restarting ADB server…'
              : ''}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-foreground shadow-none">
              <Terminal className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground text-title tracking-tight">
                  ADB & Hardware Utilities Cockpit
                </h2>
                <Badge
                  className="flex items-center gap-1.5 px-2 py-0.5 font-medium text-caption uppercase tracking-wider"
                  variant={
                    deviceMode === 'adb'
                      ? 'success'
                      : deviceMode === 'fastboot'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      deviceMode === 'adb'
                        ? 'bg-success'
                        : deviceMode === 'fastboot'
                          ? 'bg-warning'
                          : 'bg-muted-foreground',
                    )}
                  />
                  {deviceMode === 'adb'
                    ? 'ADB Active'
                    : deviceMode === 'fastboot'
                      ? 'Fastboot Active'
                      : 'No Target'}
                </Badge>
              </div>
              <p className="text-body text-muted-foreground">
                Low-level ADB daemon transport, fastboot bootloader variables, power states & host
                toolchain
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              aria-label="Restart ADB Server"
              disabled={isRestarting}
              onClick={handleRestart}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('mr-1.5 size-3.5', isRestarting && 'animate-spin')}
                data-icon="inline-start"
              />
              {isRestarting ? 'Restarting…' : 'Restart Server'}
            </Button>
            <Button
              aria-label="Refresh hardware status"
              disabled={isLoading}
              onClick={onRefresh}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-3.5', isLoading && 'animate-spin')}
                data-icon="inline-start"
              />
            </Button>
          </div>
        </div>

        {/* 6-Spec Hardware Specifications Grid */}
        <div className="grid @2xl:grid-cols-6 @lg:grid-cols-3 grid-cols-2 gap-2.5">
          <SpecItem
            copyValue={hostVersions?.adb ?? null}
            icon={Server}
            label="ADB Daemon"
            tooltip={hostVersions?.adb ?? 'ADB server status'}
            value={<span className="font-mono text-mono-sm">{adbVersion}</span>}
          />

          <SpecItem
            copyValue={hostVersions?.fastboot ?? null}
            icon={Zap}
            label="Fastboot Protocol"
            tooltip={hostVersions?.fastboot ?? 'Fastboot toolchain'}
            value={<span className="font-mono text-mono-sm">{fastbootVersion}</span>}
          />

          <SpecItem
            copyValue={deviceSerial}
            icon={Hash}
            label="Target Serial"
            tooltip={deviceSerial ?? 'No hardware device connected'}
            value={
              <span className="font-mono text-mono-sm">{deviceSerial ?? 'None connected'}</span>
            }
          />

          <SpecItem
            copyValue={deviceMode}
            icon={Smartphone}
            label="Transport Mode"
            value={
              <span className="font-medium text-body capitalize">
                {deviceMode === 'adb'
                  ? 'USB / TCP (device)'
                  : deviceMode === 'fastboot'
                    ? 'Fastboot / Bootloader'
                    : 'Offline'}
              </span>
            }
          />

          <SpecItem
            copyValue="5037"
            icon={Cpu}
            label="ADB Host Socket"
            tooltip="Local ADB Server default loopback listener port"
            value={<span className="font-mono text-mono-sm">127.0.0.1:5037</span>}
          />

          <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-surface-raised/40 p-2.5 transition-colors hover:bg-surface-raised/80">
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <div className="flex min-w-0 items-center gap-1.5">
                <Edit3 className="size-3.5 shrink-0 text-muted-foreground/80" />
                <span className="truncate font-medium text-caption uppercase tracking-wider">
                  Nickname
                </span>
              </div>
              {deviceSerial ? (
                <Button
                  aria-label="Edit device nickname"
                  className="size-5 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                  onClick={onEditNickname}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Edit3 aria-hidden="true" className="size-3" data-icon="inline-start" />
                </Button>
              ) : null}
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-1 truncate font-medium text-body text-foreground">
              <span className="truncate">
                {nickname ? (
                  <span className="font-semibold text-foreground">{nickname}</span>
                ) : (
                  <span className="text-muted-foreground italic">No nickname</span>
                )}
              </span>
              {deviceSerial && !nickname ? (
                <button
                  className="text-caption text-primary hover:underline"
                  onClick={onEditNickname}
                  type="button"
                >
                  Set
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
