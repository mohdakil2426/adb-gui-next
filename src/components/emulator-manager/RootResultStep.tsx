import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { backend } from "@/lib/desktop/models";

interface RootResultStepProps {
  avdName: string;
  error: string | null;
  isVerifying: boolean;
  onColdBoot: () => void;
  onReset: () => void;
  onRestoreStock: () => void;
  onTryManual: () => void;
  onVerifyRoot: () => void;
  result: backend.RootAvdResult | null;
  serial: string;
  verification: backend.RootVerificationResult | null;
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
  const verified = verification?.status === "verified";

  if (success) {
    return (
      <div className="flex flex-col gap-5">
        {/* Success header */}
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-8 shrink-0 text-success" />
          <div>
            {verified ? (
              <>
                <h3 className="font-semibold text-base text-foreground">
                  Root Verified
                </h3>
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{avdName}</span>{" "}
                  has working Magisk root.{" "}
                  <code className="ml-1 rounded bg-muted px-1 text-xs">
                    su -c id -u
                  </code>{" "}
                  returned{" "}
                  <code className="ml-1 rounded bg-muted px-1 text-xs">0</code>.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-base text-foreground">
                  Patch Installed
                </h3>
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{avdName}</span>{" "}
                  has a patched ramdisk. Cold boot it, then verify root before
                  using root-only tools.
                  {!result.managerInstalled && (
                    <span className="ml-1 text-warning-foreground">
                      Magisk Manager install failed — install manually from your
                      package file.
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        {verification && !verified ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="font-medium text-warning-foreground text-xs">
              Verification result
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              {verification.message}
            </p>
          </div>
        ) : null}

        {/* Next steps */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            Next Steps
          </p>
          <ol className="flex flex-col gap-1.5 text-foreground text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
                1
              </span>
              The emulator was stopped automatically. Click{" "}
              <strong>Cold Boot</strong> below to start it with root applied.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
                2
              </span>
              Open <strong>Magisk Manager</strong> and accept the{" "}
              <strong>"Additional Setup"</strong> prompt if it appears.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
                3
              </span>
              Verify root: open a terminal and run{" "}
              <code className="rounded bg-muted px-1 text-xs">su</code>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
                4
              </span>
              <span className="text-muted-foreground">
                If the emulator gets stuck in a bootloop, hold{" "}
                <strong className="text-foreground">Volume Down</strong> during
                boot to enter Safe Mode and disable Magisk modules.
              </span>
            </li>
          </ol>
        </div>

        {/* Always cold boot reminder */}
        <div className="rounded-md bg-warning/10 px-3 py-2 text-warning-foreground text-xs">
          ⚠️ <strong>Always Cold Boot</strong> after rooting. Normal Boot may
          load a snapshot that overwrites your root patch.
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            id="root-result-cold-boot"
            onClick={onColdBoot}
          >
            <RefreshCcw data-icon="inline-start" />
            Cold Boot Emulator
          </Button>
          {result.activationStatus === "patchInstalled" && (
            <Button
              className="w-full"
              disabled={isVerifying}
              id="root-result-verify"
              onClick={onVerifyRoot}
              variant="outline"
            >
              {isVerifying ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <ShieldCheck data-icon="inline-start" />
              )}
              Verify Root
            </Button>
          )}
          <Button
            className="w-full"
            id="root-result-restore"
            onClick={onRestoreStock}
            variant="outline"
          >
            <RotateCcw data-icon="inline-start" />
            Restore Stock (Undo)
          </Button>
        </div>

        <Button
          className="w-full text-muted-foreground"
          id="root-result-done"
          onClick={onReset}
          variant="ghost"
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
          <h3 className="font-semibold text-base text-foreground">
            Root Failed
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            The automated pipeline encountered an error.
          </p>
        </div>
      </div>

      {/* Error detail */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="font-medium text-destructive text-xs">Error details</p>
          <p className="mt-1 break-words text-muted-foreground text-xs">
            {error}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          id="root-result-try-manual"
          onClick={onTryManual}
          variant="outline"
        >
          <ShieldCheck data-icon="inline-start" />
          Try Manual Mode (FAKEBOOTIMG)
        </Button>
        <p className="text-muted-foreground text-xs">
          Manual mode opens the Magisk app inside the emulator so it can patch
          the boot image itself. Use this as a fallback if the automated
          pipeline fails.
        </p>
        <Button
          className="w-full"
          id="root-result-retry"
          onClick={onReset}
          variant="ghost"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
