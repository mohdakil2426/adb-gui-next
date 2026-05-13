import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Grip,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { backend } from '@/lib/desktop/models';
import { cn } from '@/lib/utils';

interface RootPreflightStepProps {
  avdName: string;
  isScanning: boolean;
  onColdBoot: () => void;
  onContinue: () => void;
  onLaunch: () => void;
  onRescan: () => void;
  onRestoreStock: () => void;
  scan: backend.RootReadinessScan | null;
}

function StatusIcon({ status }: { status: backend.CheckStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />;
    case 'warn':
      return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />;
    case 'fail':
      return <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
    case 'info':
      return <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  }
}

function CheckRow({ check }: { check: backend.ReadinessCheck }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2 text-sm',
        check.status === 'fail' && 'bg-destructive/5',
        check.status === 'warn' && 'bg-warning/5',
      )}
      id={`preflight-check-${check.id}`}
    >
      <StatusIcon status={check.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              'font-medium',
              check.status === 'fail' && 'text-destructive',
              check.status === 'warn' && 'text-warning-foreground',
              check.status === 'pass' && 'text-foreground',
              check.status === 'info' && 'text-muted-foreground',
            )}
          >
            {check.label}
          </span>
          <span className="text-muted-foreground text-xs">{check.message}</span>
        </div>
        {check.detail ? (
          <p className="mt-0.5 text-muted-foreground text-xs">{check.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function RootPreflightStep({
  scan,
  isScanning,
  avdName,
  onRescan,
  onContinue,
  onLaunch,
  onColdBoot,
  onRestoreStock,
}: RootPreflightStepProps) {
  const canProceed = scan?.canProceed ?? false;
  const recommendedAction = scan?.recommendedAction ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-base text-foreground">Root Readiness Check</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          We check your emulator's state to make sure rooting will succeed on{' '}
          <strong className="text-foreground">{avdName}</strong>.
        </p>
      </div>

      {/* Checklist */}
      {isScanning ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-muted-foreground text-sm">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          Scanning emulator state…
        </div>
      ) : scan ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/10 py-2">
          {scan.checks.map((check) => (
            <CheckRow check={check} key={check.id} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-muted-foreground text-sm">
          <Grip className="size-4 shrink-0" />
          Click &ldquo;Scan&rdquo; to check emulator readiness.
        </div>
      )}

      {/* Inline action for recommended fix */}
      {!isScanning && recommendedAction ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            Recommended Action
          </p>
          {recommendedAction.type === 'launchEmulator' && (
            <div className="flex flex-col gap-2">
              <p className="text-foreground text-sm">
                The emulator must be running before rooting.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button id="preflight-launch-btn" onClick={onLaunch} size="sm">
                  Launch Emulator
                </Button>
                <Button
                  id="preflight-cold-boot-btn"
                  onClick={onColdBoot}
                  size="sm"
                  variant="outline"
                >
                  ❄ Cold Boot (Recommended)
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Cold Boot starts the emulator fresh without loading a saved state — strongly
                recommended for rooting.
              </p>
            </div>
          )}
          {recommendedAction.type === 'coldBoot' && (
            <div className="flex flex-col gap-2">
              <p className="text-foreground text-sm">
                Your emulator loaded from a Quick Boot snapshot. Root changes may be lost if the
                emulator saves a new snapshot on shutdown.
              </p>
              <Button
                id="preflight-cold-boot-restart-btn"
                onClick={onColdBoot}
                size="sm"
                variant="outline"
              >
                ❄ Restart with Cold Boot
              </Button>
              <p className="text-muted-foreground text-xs">
                You can still proceed without cold booting, but we recommend restarting to avoid
                snapshot overwrites.
              </p>
            </div>
          )}
          {recommendedAction.type === 'restoreFirst' && (
            <div className="flex flex-col gap-2">
              <p className="text-foreground text-sm">
                The ramdisk appears to be modified. Restoring stock first gives you a clean slate.
              </p>
              <Button
                id="preflight-restore-btn"
                onClick={onRestoreStock}
                size="sm"
                variant="outline"
              >
                Restore Stock Ramdisk
              </Button>
            </div>
          )}
          {recommendedAction.type === 'unsupported' && (
            <p className="text-destructive text-sm">{recommendedAction.reason}</p>
          )}
        </div>
      ) : null}

      {/* Summary bar */}
      {!isScanning && scan ? (
        <div
          className={cn(
            'rounded-md px-3 py-2 text-xs',
            canProceed && !scan.hasWarnings && 'bg-success/10 text-success',
            canProceed && scan.hasWarnings && 'bg-warning/10 text-warning-foreground',
            !canProceed && 'bg-destructive/10 text-destructive',
          )}
        >
          {canProceed
            ? scan.hasWarnings
              ? 'Ready to proceed with warnings. Review the items above before continuing.'
              : 'All checks passed. You are ready to root!'
            : 'One or more checks failed. Resolve the issues above before rooting.'}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {scan ? (
          <Button
            className="w-full"
            disabled={!canProceed || isScanning}
            id="preflight-continue-btn"
            onClick={onContinue}
          >
            Continue to Source Selection →
          </Button>
        ) : null}
        <Button
          className="w-full"
          disabled={isScanning}
          id="preflight-rescan-btn"
          onClick={onRescan}
          variant="outline"
        >
          <RefreshCw
            className={cn('size-4', isScanning && 'animate-spin')}
            data-icon="inline-start"
          />
          {scan ? 'Rescan' : 'Scan'}
        </Button>
      </div>

      {/* Why info */}
      <p className="text-muted-foreground text-xs">
        ℹ️ Cold Boot starts the emulator without loading any saved state, ensuring root changes
        persist. Normal Boot loads a Quick Boot snapshot which may overwrite your root patch.
      </p>
    </div>
  );
}
