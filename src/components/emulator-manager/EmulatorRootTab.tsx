import { LoadingButton } from '@/components/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground">
            Select an AVD before starting the assisted root workflow.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canPrepare = Boolean(packagePath) && avd.isRunning && Boolean(avd.serial) && !isFinalizing;

  return (
    <Card>
      <CardHeader className="gap-2 border-b pb-4">
        <CardTitle className="text-base">Assisted root flow</CardTitle>
        <CardDescription>
          Import a local APK or ZIP, stage a fake boot image, patch it inside the emulator, then
          finalize the ramdisk replacement from this page.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Device requirements</p>
          <p className="mt-2 text-muted-foreground">
            {avd.isRunning && avd.serial
              ? `Ready on ${avd.serial}.`
              : 'Launch the emulator and wait for adb to report it online before preparing root.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border p-4">
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
              Choose Root Package
            </Button>
            <div className="min-w-0 text-sm text-muted-foreground">
              {packagePath ? (
                <span className="break-all">{packagePath}</span>
              ) : (
                'No root package selected'
              )}
            </div>
          </div>

          {packagePath && (
            <p className="text-xs text-muted-foreground">
              Selected package:{' '}
              <span className="font-medium text-foreground">{getFileName(packagePath)}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <LoadingButton
              isLoading={isPreparing}
              icon={<Shield className="size-4" />}
              loadingLabel="Preparing..."
              disabled={!canPrepare}
              onClick={() => void onPrepare(packagePath)}
            >
              Prepare Root
            </LoadingButton>
            <LoadingButton
              variant="outline"
              isLoading={isFinalizing}
              icon={<Shield className="size-4" />}
              loadingLabel="Finalizing..."
              disabled={!rootSession || isPreparing}
              onClick={() => void onFinalize()}
            >
              Finalize Root
            </LoadingButton>
          </div>
        </div>

        {rootSession ? (
          <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="font-medium">Root session active</p>
              <p className="mt-1 text-sm text-muted-foreground break-all">
                Staged package: {rootSession.normalizedPackagePath}
              </p>
              <p className="text-sm text-muted-foreground break-all">
                Fake boot image: {rootSession.fakeBootRemotePath}
              </p>
            </div>

            <ol className="space-y-2 pl-5 text-sm text-muted-foreground">
              {rootSession.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Preparing root will create backups first, then guide you through the fake-boot patch
            flow.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
