import { AlertCircle } from 'lucide-react';
import type { backend } from '@/lib/desktop/models';
import { RootWizard } from './RootWizard';

interface EmulatorRootTabProps {
  avd: backend.AvdSummary | null;
}

export function EmulatorRootTab({ avd }: EmulatorRootTabProps) {
  if (!avd) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Select an AVD before starting the root workflow.
      </p>
    );
  }

  if (!avd.isRunning || !avd.serial) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">{avd.name}</span> is not running. Launch the emulator
            and wait for it to fully boot before rooting.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: use the <strong>Launch</strong> tab to start this AVD, then return here.
        </p>
      </div>
    );
  }

  return <RootWizard avd={avd} />;
}
