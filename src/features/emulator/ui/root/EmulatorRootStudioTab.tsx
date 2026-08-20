import { Info, Lock, Play, ShieldAlert, Snowflake } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
} from '@/features/emulator/model/launchOptions';
import { RootWizard } from '@/features/emulator/ui/RootWizard';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface EmulatorRootStudioTabProps {
  avd: backend.AvdSummary | null;
  onLaunch: (options: backend.EmulatorLaunchOptions) => void;
}

export function EmulatorRootStudioTab({ avd, onLaunch }: EmulatorRootStudioTabProps) {
  const applyLaunchPreset = useEmulatorManagerStore((state) => state.applyLaunchPreset);

  if (!avd) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised/40 p-8 text-center">
        <p className="text-body text-muted-foreground">
          Select an AVD before starting the root workflow.
        </p>
      </div>
    );
  }

  if (!(avd.isRunning && avd.serial)) {
    const launchWith = (options: backend.EmulatorLaunchOptions) => {
      applyLaunchPreset(options);
      onLaunch(options);
    };

    return (
      <Card className="@container rounded-xl border-border bg-surface py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <CardTitle
            as="h2"
            className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
          >
            <Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />
            Root Studio · Device Online Gate
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-4.5">
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-muted p-4">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold text-body text-foreground">
                {avd.name} is currently offline
              </p>
              <p className="text-caption text-muted-foreground">
                Rooting patches the active live emulator kernel/ramdisk. Launch {avd.name} below
                before proceeding with the automated magiskboot pipeline.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              id="root-gate-cold-boot-btn"
              onClick={() => {
                launchWith(COLD_BOOT_LAUNCH_OPTIONS);
              }}
              size="sm"
              type="button"
            >
              <Snowflake aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Cold boot (recommended)
            </Button>
            <Button
              id="root-gate-launch-btn"
              onClick={() => {
                launchWith(DEFAULT_LAUNCH_OPTIONS);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Play aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Normal launch
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-surface-raised/30 p-3 text-caption text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-info" />
            <span>
              <strong>Why Cold Boot?</strong> Cold boot starts the emulator without restoring a
              saved snapshot. A normal launch may reload an older snapshot taken prior to rooting,
              silently reverting the patched ramdisk.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <RootWizard avd={avd} />;
}
