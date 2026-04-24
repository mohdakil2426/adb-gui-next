import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
        <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
          <AlertCircle />
          <AlertTitle>{avd.name} is not running</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            Launch the emulator and wait for it to fully boot before rooting.
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          Tip: use the <strong>Launch</strong> tab to start this AVD, then return here.
        </p>
      </div>
    );
  }

  return <RootWizard avd={avd} />;
}
