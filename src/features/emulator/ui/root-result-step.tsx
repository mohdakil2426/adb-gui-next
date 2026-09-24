import {
  CircleCheck,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import type { backend } from "@/desktop/models";
import { SectionHeader } from "@/shared/components/section-header";
import { Button } from "@/shared/ui/button";

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

const NEXT_STEPS: { content: ReactNode; id: string }[] = [
  {
    content: (
      <>
        The emulator was stopped automatically. Use <strong>Cold Boot Emulator</strong> below to
        start it with the patch applied.
      </>
    ),
    id: "cold-boot",
  },
  {
    content: (
      <>
        Open <strong>Magisk Manager</strong> on the emulator and accept the &ldquo;Additional
        Setup&rdquo; prompt if it appears.
      </>
    ),
    id: "magisk-setup",
  },
  {
    content: (
      <>
        Verify root from a shell:{" "}
        <code className="bg-muted text-mono rounded-sm px-1 font-mono">su</code> should return a
        root prompt.
      </>
    ),
    id: "verify-root",
  },
  {
    content: (
      <>
        If the emulator bootloops, hold <strong>Volume Down</strong> during boot to enter Safe Mode
        and disable Magisk modules.
      </>
    ),
    id: "safe-mode",
  },
];

export const RootResultStep = ({
  result,
  verification,
  isVerifying,
  error,
  avdName,
  onVerifyRoot,
  onColdBoot,
  onRestoreStock,
  onReset,
  onTryManual,
}: RootResultStepProps) => {
  const success = result !== null && error === null;
  const verified = verification?.status === "verified";

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CircleCheck aria-hidden="true" className="text-success mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            {verified ? (
              <>
                <h3 className="text-title">Root Verified</h3>
                <p className="text-body text-muted-foreground mt-0.5">
                  <span className="text-foreground font-medium">{avdName}</span> has working Magisk
                  root —{" "}
                  <code className="bg-muted text-mono rounded-sm px-1 font-mono">su -c id -u</code>{" "}
                  returned <code className="bg-muted text-mono rounded-sm px-1 font-mono">0</code>.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-title">Patch Installed</h3>
                <p className="text-body text-muted-foreground mt-0.5">
                  <span className="text-foreground font-medium">{avdName}</span> has a patched
                  ramdisk. Cold boot it, then verify root before using root-only tools.
                  {result.managerInstalled ? null : (
                    <span className="text-warning ml-1">
                      Magisk Manager did not install — install it manually from your package file.
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        {verification && !verified ? (
          <div className="border-warning/30 bg-warning-muted rounded-md border p-3">
            <p className="text-body text-foreground">Verification result</p>
            <p className="text-caption text-muted-foreground mt-0.5">{verification.message}</p>
          </div>
        ) : null}

        <div className="border-border bg-surface-raised flex flex-col gap-2 rounded-md border p-3">
          <SectionHeader>Next steps</SectionHeader>
          <ol className="text-body text-foreground flex flex-col gap-1.5">
            {NEXT_STEPS.map((step, index) => (
              <li className="flex items-start gap-2" key={step.id}>
                <span className="numeric bg-primary text-caption text-primary-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                  {index + 1}
                </span>
                <span className="min-w-0">{step.content}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="bg-warning-muted text-caption text-warning flex items-start gap-2 rounded-md px-3 py-2">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Always cold boot after rooting. A normal boot can load a snapshot taken before the patch
            and silently revert it.
          </span>
        </p>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            id="root-result-cold-boot"
            onClick={onColdBoot}
            size="sm"
            type="button"
          >
            <RefreshCcw aria-hidden="true" data-icon="inline-start" />
            Cold Boot Emulator
          </Button>
          {result.activationStatus === "patchInstalled" && (
            <Button
              className="w-full"
              disabled={isVerifying}
              id="root-result-verify"
              onClick={onVerifyRoot}
              size="sm"
              type="button"
              variant="outline"
            >
              {isVerifying ? (
                <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
              ) : (
                <ShieldCheck aria-hidden="true" data-icon="inline-start" />
              )}
              Verify Root
            </Button>
          )}
          <Button
            className="w-full"
            id="root-result-restore"
            onClick={onRestoreStock}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" data-icon="inline-start" />
            Restore stock (undo)
          </Button>
          <Button
            className="text-muted-foreground w-full"
            id="root-result-done"
            onClick={onReset}
            size="sm"
            type="button"
            variant="ghost"
          >
            Close wizard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="text-destructive mt-0.5 size-6 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-title">Root failed</h3>
          <p className="text-body text-muted-foreground mt-0.5">
            The automated pipeline stopped before the patch was installed. Nothing was written to
            the AVD.
          </p>
        </div>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive-muted rounded-md border p-3">
          <p className="text-body text-destructive">Error details</p>
          <p className="text-mono-sm text-muted-foreground mt-0.5 font-mono break-words">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          id="root-result-try-manual"
          onClick={onTryManual}
          size="sm"
          type="button"
          variant="outline"
        >
          <ShieldCheck aria-hidden="true" data-icon="inline-start" />
          Switch to Manual FAKEBOOTIMG mode
        </Button>
        <p className="text-caption text-muted-foreground">
          Manual mode is the recommended path for modern Magisk (v26 and above). It opens the Magisk
          app inside the emulator so you patch the boot image there.
        </p>
        <Button
          className="w-full"
          id="root-result-retry"
          onClick={onReset}
          size="sm"
          type="button"
          variant="ghost"
        >
          Try again
        </Button>
      </div>
    </div>
  );
};
