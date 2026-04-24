import { AlertTriangle, CheckCircle2, RefreshCcw, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { backend } from '@/lib/desktop/models';

interface RootResultStepProps {
  result: backend.RootAvdResult | null;
  error: string | null;
  avdName: string;
  serial: string;
  onColdBoot: () => void;
  onRestoreStock: () => void;
  onTryManual: () => void;
  onReset: () => void;
}

export function RootResultStep({
  result,
  error,
  avdName,
  onColdBoot,
  onRestoreStock,
  onTryManual,
  onReset,
}: RootResultStepProps) {
  const success = result !== null && error === null;

  if (success) {
    return (
      <div className="flex flex-col gap-5">
        {/* Success header */}
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-8 shrink-0 text-success" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Root Successful!</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{avdName}</span> is now rooted with
              Magisk {result.magiskVersion ? `v${result.magiskVersion}` : ''}.
              {!result.managerInstalled && (
                <span className="ml-1 text-warning-foreground">
                  Magisk Manager install failed — install manually from your package file.
                </span>
              )}
            </p>
          </div>
        </div>

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
              Open <strong>Magisk Manager</strong> to configure modules.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                3
              </span>
              Verify root: open a terminal and run{' '}
              <code className="rounded bg-muted px-1 text-xs">su</code>.
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button id="root-result-cold-boot" className="w-full" onClick={onColdBoot}>
            <RefreshCcw data-icon="inline-start" />
            Cold Boot Emulator
          </Button>
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
        <Button id="root-result-retry" variant="ghost" className="w-full" onClick={onReset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
