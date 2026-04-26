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
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';

interface RootPreflightStepProps {
  scan: backend.RootReadinessScan | null;
  isScanning: boolean;
  avdName: string;
  onRescan: () => void;
  onContinue: () => void;
  onLaunch: () => void;
  onColdBoot: () => void;
  onRestoreStock: () => void;
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
      id={`preflight-check-${check.id}`}
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2 text-sm',
        check.status === 'fail' && 'bg-destructive/5',
        check.status === 'warn' && 'bg-warning/5',
      )}
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
          <span className="text-xs text-muted-foreground">{check.message}</span>
        </div>
        {check.detail && <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>}
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
        <h3 className="text-base font-semibold text-foreground">Root Readiness Check</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We check your emulator's state to make sure rooting will succeed on{' '}
          <strong className="text-foreground">{avdName}</strong>.
        </p>
      </div>

      {/* Checklist */}
      {isScanning ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" />
          Scanning emulator state…
        </div>
      ) : scan ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/10 py-2">
          {scan.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          <Grip className="size-4 shrink-0" />
          Click &ldquo;Scan&rdquo; to check emulator readiness.
        </div>
      )}

      {/* Inline action for recommended fix */}
      {!isScanning && recommendedAction && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended Action
          </p>
          {recommendedAction.type === 'launchEmulator' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                The emulator must be running before rooting.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button id="preflight-launch-btn" size="sm" onClick={onLaunch}>
                  Launch Emulator
                </Button>
                <Button
                  id="preflight-cold-boot-btn"
                  size="sm"
                  variant="outline"
                  onClick={onColdBoot}
                >
                  ❄ Cold Boot (Recommended)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cold Boot starts the emulator fresh without loading a saved state — strongly
                recommended for rooting.
              </p>
            </div>
          )}
          {recommendedAction.type === 'coldBoot' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                Your emulator loaded from a Quick Boot snapshot. Root changes may be lost if the
                emulator saves a new snapshot on shutdown.
              </p>
              <Button
                id="preflight-cold-boot-restart-btn"
                size="sm"
                variant="outline"
                onClick={onColdBoot}
              >
                ❄ Restart with Cold Boot
              </Button>
              <p className="text-xs text-muted-foreground">
                You can still proceed without cold booting, but we recommend restarting to avoid
                snapshot overwrites.
              </p>
            </div>
          )}
          {recommendedAction.type === 'restoreFirst' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                The ramdisk appears to be modified. Restoring stock first gives you a clean slate.
              </p>
              <Button
                id="preflight-restore-btn"
                size="sm"
                variant="outline"
                onClick={onRestoreStock}
              >
                Restore Stock Ramdisk
              </Button>
            </div>
          )}
          {recommendedAction.type === 'unsupported' && (
            <p className="text-sm text-destructive">{recommendedAction.reason}</p>
          )}
        </div>
      )}

      {/* Summary bar */}
      {!isScanning && scan && (
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
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {scan && (
          <Button
            id="preflight-continue-btn"
            className="w-full"
            disabled={!canProceed || isScanning}
            onClick={onContinue}
          >
            Continue to Source Selection →
          </Button>
        )}
        <Button
          id="preflight-rescan-btn"
          variant="outline"
          className="w-full"
          disabled={isScanning}
          onClick={onRescan}
        >
          <RefreshCw
            className={cn('size-4', isScanning && 'animate-spin')}
            data-icon="inline-start"
          />
          {scan ? 'Rescan' : 'Scan'}
        </Button>
      </div>

      {/* Why info */}
      <p className="text-xs text-muted-foreground">
        ℹ️ Cold Boot starts the emulator without loading any saved state, ensuring root changes
        persist. Normal Boot loads a Quick Boot snapshot which may overwrite your root patch.
      </p>
    </div>
  );
}
