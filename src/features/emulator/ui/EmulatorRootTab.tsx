import { Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { backend } from '@/lib/desktop/models';
import { RootWizard } from './RootWizard';

interface EmulatorRootTabProps {
  avd: backend.AvdSummary | null;
  onLaunch: (options: backend.EmulatorLaunchOptions) => void;
}

function createLaunchOptions(preset: 'default' | 'coldBoot'): backend.EmulatorLaunchOptions {
  return {
    wipeData: false,
    writableSystem: false,
    coldBoot: preset === 'coldBoot',
    noSnapshotLoad: preset === 'coldBoot',
    noSnapshotSave: preset === 'coldBoot',
    noBootAnim: false,
  };
}

export function EmulatorRootTab({ avd, onLaunch }: EmulatorRootTabProps) {
  if (!avd) {
    return (
      <p className="py-4 text-muted-foreground text-sm">
        Select an AVD before starting the root workflow.
      </p>
    );
  }

  if (!(avd.isRunning && avd.serial)) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {/* Smart gate — not a dead end */}
        <div className="rounded-lg border border-border bg-muted/20 p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold text-base text-foreground">
              🔒 {avd.name} is not running
            </span>
          </div>
          <p className="mb-4 text-muted-foreground text-sm">
            The emulator must be running before rooting. Choose how to start it:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              id="root-gate-launch-btn"
              onClick={() => {
                onLaunch(createLaunchOptions('default'));
              }}
              size="sm"
            >
              ▶ Launch
            </Button>
            <Button
              id="root-gate-cold-boot-btn"
              onClick={() => {
                onLaunch(createLaunchOptions('coldBoot'));
              }}
              size="sm"
              variant="outline"
            >
              <Snowflake data-icon="inline-start" />
              Cold Boot (Recommended)
            </Button>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            ℹ️ <strong>Cold Boot</strong> is recommended for rooting — it starts the emulator fresh
            without loading a saved state, so your root patch won't be overwritten by a snapshot.
          </p>
        </div>
      </div>
    );
  }

  return <RootWizard avd={avd} />;
}
