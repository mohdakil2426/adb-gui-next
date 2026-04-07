import { LoadingButton } from '@/components/LoadingButton';
import { Button } from '@/components/ui/button';
import { SelectRootPackageFile } from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import type { RootSessionState } from '@/lib/emulatorManagerStore';
import { getFileName } from '@/lib/utils';
import { Shield, Upload } from 'lucide-react';
import { useState } from 'react';

interface EmulatorRootTabProps {
  avd: backend.AvdSummary | null;
  isPreparing: boolean;
  isFinalizing: boolean;
  rootSession: RootSessionState | null;
  onPrepare: (rootPackagePath: string) => Promise<void>;
  onFinalize: () => Promise<void>;
}

export function EmulatorRootTab({
  avd,
  isPreparing,
  isFinalizing,
  rootSession,
  onPrepare,
  onFinalize,
}: EmulatorRootTabProps) {
  const [packagePath, setPackagePath] = useState('');

  if (!avd) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Select an AVD before starting the assisted root workflow.
      </p>
    );
  }

  const canPrepare = Boolean(packagePath) && avd.isRunning && Boolean(avd.serial) && !isFinalizing;

  const isReady = avd.isRunning && avd.serial;

  return (
    <div className="space-y-5">
      {/* Device status */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          isReady
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-border bg-muted/40 text-muted-foreground'
        }`}
      >
        {isReady
          ? `Emulator online on ${avd.serial} — ready for root operations.`
          : 'Launch the emulator and wait for ADB to report it online before preparing root.'}
      </div>

      {/* Package picker */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              const selected = await SelectRootPackageFile();
              if (selected) {
                setPackagePath(selected);
              }
            }}
          >
            <Upload className="size-4" />
            Choose root package
          </Button>
          <span className="min-w-0 text-sm text-muted-foreground">
            {packagePath ? getFileName(packagePath) : 'No package selected'}
          </span>
        </div>
        {packagePath && <p className="break-all text-xs text-muted-foreground">{packagePath}</p>}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <LoadingButton
          isLoading={isPreparing}
          icon={<Shield className="size-4" />}
          loadingLabel="Preparing…"
          disabled={!canPrepare}
          onClick={() => void onPrepare(packagePath)}
        >
          Prepare root
        </LoadingButton>
        <LoadingButton
          variant="outline"
          isLoading={isFinalizing}
          icon={<Shield className="size-4" />}
          loadingLabel="Finalizing…"
          disabled={!rootSession || isPreparing}
          onClick={() => void onFinalize()}
        >
          Finalize root
        </LoadingButton>
      </div>

      {/* Active root session */}
      {rootSession ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Root session active</p>
          <p className="mt-2 break-all text-muted-foreground">
            Staged: {rootSession.normalizedPackagePath}
          </p>
          <p className="break-all text-muted-foreground">
            Fake boot: {rootSession.fakeBootRemotePath}
          </p>
          {rootSession.instructions.length > 0 && (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              {rootSession.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Preparing root will create backups first, then guide you through the patch flow.
        </p>
      )}
    </div>
  );
}
