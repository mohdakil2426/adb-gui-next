import { Info, Lock, Play, ShieldAlert, Snowflake } from "lucide-react";

import type { backend } from "@/desktop/models";
import { useEmulatorManagerStore } from "@/features/emulator/model/emulator-manager-store";
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
} from "@/features/emulator/model/launch-options";
import { RootWizard } from "@/features/emulator/ui/root-wizard";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface EmulatorRootStudioTabProps {
  avd: backend.AvdSummary | null;
  onLaunch: (options: backend.EmulatorLaunchOptions) => void;
}

export const EmulatorRootStudioTab = ({ avd, onLaunch }: EmulatorRootStudioTabProps) => {
  const applyLaunchPreset = useEmulatorManagerStore((state) => state.applyLaunchPreset);

  if (!avd) {
    return (
      <div className="border-border bg-surface-raised/40 rounded-lg border p-8 text-center">
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
      <Card className="border-border bg-surface @container rounded-xl py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <CardTitle
            as="h2"
            className="text-caption text-muted-foreground flex items-center gap-2 font-medium tracking-wider uppercase"
          >
            <Lock aria-hidden="true" className="text-muted-foreground size-3.5" />
            Root Studio · Device Online Gate
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-4.5">
          <div className="border-warning/40 bg-warning-muted flex items-start gap-3 rounded-xl border p-4">
            <ShieldAlert aria-hidden="true" className="text-warning mt-0.5 size-5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-body text-foreground font-semibold">
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

          <div className="border-border/40 bg-surface-raised/30 text-caption text-muted-foreground flex items-start gap-2 rounded-lg border p-3">
            <Info aria-hidden="true" className="text-info mt-0.5 size-3.5 shrink-0" />
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
};
