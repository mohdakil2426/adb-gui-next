import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { backend } from '@/lib/desktop/models';

interface RootResultStepProps {
  result: backend.RootAvdResult | null;
  verification: backend.RootVerificationResult | null;
  isVerifying: boolean;
  error: string | null;
  avdName: string;
  serial: string;
  onVerifyRoot: () => void;
  onColdBoot: () => void;
  onRestoreStock: () => void;
  onTryManual: () => void;
  onReset: () => void;
}

export function RootResultStep({
  result,
  verification,
  isVerifying,
  error,
  avdName,
  onVerifyRoot,
  onColdBoot,
  onRestoreStock,
  onTryManual,
  onReset,
}: RootResultStepProps) {
  const success = result !== null && error === null;
  const verified = verification?.status === 'verified';

  if (success) {
    return (
      <div className="flex flex-col gap-5">
        {/* Success header */}
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-8 shrink-0 text-success" />
          <div>
            {verified ? (
              <>
                <h3 className="text-base font-semibold text-foreground">Root Verified</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{avdName}</span> has working Magisk
                  root. <code className="ml-1 rounded bg-muted px-1 text-xs">su -c id -u</code>{' '}
                  returned <code className="ml-1 rounded bg-muted px-1 text-xs">0</code>.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground">Patch Installed</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{avdName}</span> has a patched
                  ramdisk. Cold boot it, then verify root before using root-only tools.
                  {!result.managerInstalled && (
                    <span className="ml-1 text-warning-foreground">
                      Magisk Manager install failed — install manually from your package file.
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        {verification && !verified && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning-foreground">Verification result</p>
            <p className="mt-1 text-xs text-muted-foreground">{verification.message}</p>
          </div>
        )}

        {/* Next steps */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next Steps
          </p>
          <ol className="flex flex-col gap-1.5 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                1
              </span>
              The emulator was stopped automatically. Click <strong>Cold Boot</strong> below to
              start it with root applied.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                2
              </span>
              Open <strong>Magisk Manager</strong> and accept the{' '}
              <strong>"Additional Setup"</strong> prompt if it appears.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                3
              </span>
              Verify root: open a terminal and run{' '}
              <code className="rounded bg-muted px-1 text-xs">su</code>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                4
              </span>
              <span className="text-muted-foreground">
                If the emulator gets stuck in a bootloop, hold{' '}
                <strong className="text-foreground">Volume Down</strong> during boot to enter Safe
                Mode and disable Magisk modules.
              </span>
            </li>
          </ol>
        </div>

        {/* Always cold boot reminder */}
        <div className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          ⚠️ <strong>Always Cold Boot</strong> after rooting. Normal Boot may load a snapshot that
          overwrites your root patch.
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button id="root-result-cold-boot" className="w-full" onClick={onColdBoot}>
            <RefreshCcw data-icon="inline-start" />
            Cold Boot Emulator
          </Button>
          {result.activationStatus === 'patchInstalled' && (
            <Button
              id="root-result-verify"
              variant="outline"
              className="w-full"
              disabled={isVerifying}
              onClick={onVerifyRoot}
            >
              {isVerifying ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ShieldCheck data-icon="inline-start" />
              )}
              Verify Root
            </Button>
          )}
          <Button
            id="root-result-restore"
            variant="outline"
            className="w-full"
            onClick={onRestoreStock}
          >
            <RotateCcw data-icon="inline-start" />
            Restore Stock (Undo)
          </Button>
        </div>

        <Button
          id="root-result-done"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onReset}
        >
          Done
        </Button>
      </div>
    );
  }

  // Failure state
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-8 shrink-0 text-destructive" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Root Failed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The automated pipeline encountered an error.
          </p>
        </div>
      </div>

      {/* Error detail */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive">Error details</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          id="root-result-try-manual"
          variant="outline"
          className="w-full"
          onClick={onTryManual}
        >
          <ShieldCheck data-icon="inline-start" />
          Try Manual Mode (FAKEBOOTIMG)
        </Button>
        <p className="text-xs text-muted-foreground">
          Manual mode opens the Magisk app inside the emulator so it can patch the boot image
          itself. Use this as a fallback if the automated pipeline fails.
        </p>
        <Button id="root-result-retry" variant="ghost" className="w-full" onClick={onReset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
