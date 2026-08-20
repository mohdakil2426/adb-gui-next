import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  RotateCcw,
  Sliders,
  Terminal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildAdbInstallFlags,
  DEFAULT_INSTALL_FLAGS,
  useInstallationStore,
} from '@/features/app-manager/debloater/model/installationStore';
import { INSTALL_FLAGS_CATALOG } from '@/features/app-manager/debloater/model/installFlags';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/utils/cn';

interface InstallFlagsCockpitProps {
  disabled?: boolean;
}

/**
 * Precision Hardware Cockpit switchboard for ADB installation flags.
 * Gives developers full control over `-r`, `-d`, `-g`, `-t`, and low-SDK bypass flags.
 */
export function InstallFlagsCockpit({ disabled = false }: InstallFlagsCockpitProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const installFlags = useInstallationStore((s) => s.installFlags);
  const setInstallFlags = useInstallationStore((s) => s.setInstallFlags);
  const resetInstallFlags = useInstallationStore((s) => s.resetInstallFlags);

  const activeFlagArgs = useMemo(() => buildAdbInstallFlags(installFlags), [installFlags]);

  const isCustomized = useMemo(
    () =>
      installFlags.reinstall !== DEFAULT_INSTALL_FLAGS.reinstall ||
      installFlags.allowDowngrade !== DEFAULT_INSTALL_FLAGS.allowDowngrade ||
      installFlags.grantPermissions !== DEFAULT_INSTALL_FLAGS.grantPermissions ||
      installFlags.allowTestPackages !== DEFAULT_INSTALL_FLAGS.allowTestPackages ||
      installFlags.bypassLowTargetSdk !== DEFAULT_INSTALL_FLAGS.bypassLowTargetSdk ||
      installFlags.userId !== DEFAULT_INSTALL_FLAGS.userId,
    [installFlags],
  );

  const applyPreset = (preset: 'default' | 'developer' | 'legacy') => {
    if (preset === 'default') {
      resetInstallFlags();
    } else if (preset === 'developer') {
      setInstallFlags({
        allowDowngrade: true,
        allowTestPackages: true,
        bypassLowTargetSdk: false,
        grantPermissions: true,
        reinstall: true,
      });
    } else if (preset === 'legacy') {
      setInstallFlags({
        allowDowngrade: true,
        allowTestPackages: false,
        bypassLowTargetSdk: true,
        grantPermissions: false,
        reinstall: true,
      });
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface shadow-none">
      {/* Header Banner & Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md border border-border bg-surface-raised text-muted-foreground">
            <Sliders aria-hidden="true" className="size-3.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-body text-foreground">
                ADB Install Flags Cockpit
              </span>
              {isCustomized ? (
                <Badge className="h-4.5 px-1.5 text-caption" variant="secondary">
                  Customized
                </Badge>
              ) : null}
            </div>
            <span className="text-caption text-muted-foreground">
              Configure parameters sent to{' '}
              <code className="font-mono text-foreground/80">adb install</code>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Active Flags Command Preview Pill */}
          <div className="@lg:flex hidden items-center gap-1 rounded-md border border-border-control bg-surface-raised px-2 py-1 font-mono text-foreground text-mono-sm">
            <Terminal aria-hidden="true" className="size-3 text-muted-foreground" />
            <span>adb install {activeFlagArgs.join(' ') || '(none)'}</span>
          </div>

          {isCustomized ? (
            <Button
              className="h-7 px-2 text-caption text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={resetInstallFlags}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-3" data-icon="inline-start" />
              Reset
            </Button>
          ) : null}

          <Button
            className="h-7 gap-1 px-2.5 font-medium text-caption"
            onClick={() => setIsExpanded((v) => !v)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isExpanded ? (
              <>
                <ChevronUp aria-hidden="true" className="size-3.5" />
                Hide Controls
              </>
            ) : (
              <>
                <ChevronDown aria-hidden="true" className="size-3.5" />
                Configure ({activeFlagArgs.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Precision Toggle Switchboard */}
      {isExpanded ? (
        <div className="flex flex-col gap-3 border-border border-t bg-surface-raised/40 p-3.5">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-caption text-muted-foreground uppercase tracking-wider">
              Quick Setup Presets
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                className="h-6.5 px-2 text-caption"
                disabled={disabled}
                onClick={() => applyPreset('default')}
                size="sm"
                type="button"
                variant="outline"
              >
                Standard (-r)
              </Button>
              <Button
                className="h-6.5 px-2 text-caption"
                disabled={disabled}
                onClick={() => applyPreset('developer')}
                size="sm"
                type="button"
                variant="outline"
              >
                <Cpu aria-hidden="true" className="size-3" data-icon="inline-start" />
                Dev Mode (-r -g -t -d)
              </Button>
              <Button
                className="h-6.5 px-2 text-caption"
                disabled={disabled}
                onClick={() => applyPreset('legacy')}
                size="sm"
                type="button"
                variant="outline"
              >
                Legacy / Android 14+ Bypass
              </Button>
            </div>
          </div>

          {/* Grid of Switchboard Tiles */}
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-2.5">
            {INSTALL_FLAGS_CATALOG.map((item) => {
              const isChecked = Boolean(installFlags[item.id]);

              return (
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors',
                    isChecked
                      ? 'border-foreground/20 bg-surface shadow-xs'
                      : 'border-border/70 bg-surface/50 opacity-80 hover:opacity-100',
                  )}
                  key={item.id}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold font-mono text-foreground text-mono">
                        {item.flag}
                      </span>
                      <span className="font-medium text-body text-foreground">{item.label}</span>
                      {item.badge ? (
                        <Badge
                          className="h-4 px-1 text-[10px]"
                          variant={item.badgeTone === 'warning' ? 'outline' : 'secondary'}
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-caption text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>

                    {item.riskNotice && isChecked ? (
                      <div className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500 dark:text-amber-400">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                        <span>{item.riskNotice}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-0.5">
                    <Switch
                      aria-label={`Toggle flag ${item.flag}`}
                      checked={isChecked}
                      disabled={disabled}
                      id={`flag-${item.id}`}
                      onCheckedChange={(checked) => {
                        setInstallFlags({ [item.id]: checked });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* User ID specification note */}
          <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-caption text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Info aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>
                Targets current active user profile (
                <code className="font-mono text-foreground">--user 0</code> by default).
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-foreground text-mono-sm">
              <span>Selected flags:</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-primary">
                {activeFlagArgs.join(' ') || 'none'}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
