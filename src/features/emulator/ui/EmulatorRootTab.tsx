import { Info, Lock, Play, Snowflake } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
} from '@/features/emulator/model/launchOptions';
import { RootWizard } from '@/features/emulator/ui/RootWizard';
import { Button } from '@/shared/ui/button';

interface EmulatorRootTabProps {
  avd: backend.AvdSummary | null;
  onLaunch: (options: backend.EmulatorLaunchOptions) => void;
}

export function EmulatorRootTab({ avd, onLaunch }: EmulatorRootTabProps) {
  const applyLaunchPreset = useEmulatorManagerStore((state) => state.applyLaunchPreset);

  if (!avd) {
    return (
      <p className="py-4 text-body text-muted-foreground">
        Select an AVD before starting the root workflow.
      </p>
    );
  }

  if (!(avd.isRunning && avd.serial)) {
    // Smart gate, not a dead end: say why it is blocked, then offer both
    // remedies inline and name the one to pick. Each remedy also writes the
    // preset into the shared launch options, so the Launch tab shows what ran.
    const launchWith = (options: backend.EmulatorLaunchOptions) => {
      applyLaunchPreset(options);
      onLaunch(options);
    };

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex items-start gap-2.5">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-title">{avd.name} is not running</p>
            <p className="mt-0.5 text-body text-muted-foreground">
              Rooting patches the live emulator, so it has to be started first. Choose how:
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            id="root-gate-cold-boot-btn"
            onClick={() => {
              launchWith(COLD_BOOT_LAUNCH_OPTIONS);
            }}
            size="sm"
            type="button"
          >
            <Snowflake aria-hidden="true" />
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
            <Play aria-hidden="true" />
            Normal launch
          </Button>
        </div>

        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Cold boot starts the emulator without restoring a saved snapshot. A normal launch can
            reload a snapshot taken before rooting, which silently reverts the patch.
          </span>
        </p>
      </div>
    );
  }

  return <RootWizard avd={avd} />;
}
