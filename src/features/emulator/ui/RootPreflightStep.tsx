import {
  CircleAlert,
  CircleCheck,
  Info,
  Loader2,
  ScanSearch,
  Snowflake,
  TriangleAlert,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

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
      return <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />;
    case 'warn':
      return <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />;
    case 'fail':
      return <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />;
    case 'info':
      return <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  }
}

function CheckRow({ check }: { check: backend.ReadinessCheck }) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2 text-body',
        check.status === 'fail' && 'bg-destructive-muted',
        check.status === 'warn' && 'bg-warning-muted',
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
              check.status === 'warn' && 'text-warning',
              check.status === 'pass' && 'text-foreground',
              check.status === 'info' && 'text-muted-foreground',
            )}
          >
            {check.label}
          </span>
          <span className="text-caption text-muted-foreground">{check.message}</span>
        </div>
        {check.detail ? (
          <p className="mt-0.5 text-caption text-muted-foreground">{check.detail}</p>
        ) : null}
      </div>
    </li>
  );
}

function RecommendedAction({
  action,
  onColdBoot,
  onLaunch,
  onRestoreStock,
}: {
  action: backend.RecommendedAction;
  onColdBoot: () => void;
  onLaunch: () => void;
  onRestoreStock: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
      <SectionHeader>Recommended action</SectionHeader>
      {action.type === 'launchEmulator' && (
        <>
          <p className="text-body text-foreground">The emulator must be running before rooting.</p>
          <div className="flex flex-wrap gap-2">
            <Button id="preflight-cold-boot-btn" onClick={onColdBoot} size="sm" type="button">
              <Snowflake aria-hidden="true" />
              Cold boot (recommended)
            </Button>
            <Button
              id="preflight-launch-btn"
              onClick={onLaunch}
              size="sm"
              type="button"
              variant="outline"
            >
              Launch emulator
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">
            Cold boot starts the emulator without a saved snapshot, so the root patch cannot be
            reverted by one.
          </p>
        </>
      )}
      {action.type === 'coldBoot' && (
        <>
          <p className="text-body text-foreground">
            This emulator loaded from a Quick Boot snapshot. Root changes can be lost when it saves
            a new snapshot on shutdown.
          </p>
          <Button
            className="w-fit"
            id="preflight-cold-boot-restart-btn"
            onClick={onColdBoot}
            size="sm"
            type="button"
            variant="outline"
          >
            <Snowflake aria-hidden="true" />
            Restart with cold boot
          </Button>
          <p className="text-caption text-muted-foreground">
            You can continue without restarting, but the patch may not survive the next shutdown.
          </p>
        </>
      )}
      {action.type === 'restoreFirst' && (
        <>
          <p className="text-body text-foreground">
            The ramdisk is already modified. Restoring the stock files first gives the patch a clean
            starting point.
          </p>
          <Button
            className="w-fit"
            id="preflight-restore-btn"
            onClick={onRestoreStock}
            size="sm"
            type="button"
            variant="outline"
          >
            Restore stock ramdisk
          </Button>
        </>
      )}
      {action.type === 'unsupported' && (
        <p className="text-body text-destructive">{action.reason}</p>
      )}
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
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-title">Root readiness check</h3>
        <p className="mt-0.5 text-body text-muted-foreground">
          These checks confirm rooting will succeed on{' '}
          <span className="font-mono text-foreground text-mono">{avdName}</span> before anything is
          written.
        </p>
      </div>

      {isScanning ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-raised px-4 py-5 text-body text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          Scanning emulator state…
        </div>
      ) : scan ? (
        <ul className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised py-2">
          {scan.checks.map((check) => (
            <CheckRow check={check} key={check.id} />
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 rounded-md border border-border border-dashed bg-surface-raised px-4 py-5 text-body text-muted-foreground">
          <ScanSearch aria-hidden="true" className="size-4 shrink-0" />
          Run the preflight scan to check this emulator&rsquo;s readiness.
        </div>
      )}

      {!isScanning && recommendedAction ? (
        <RecommendedAction
          action={recommendedAction}
          onColdBoot={onColdBoot}
          onLaunch={onLaunch}
          onRestoreStock={onRestoreStock}
        />
      ) : null}

      {!isScanning && scan ? (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-caption',
            canProceed && !scan.hasWarnings && 'bg-success-muted text-success',
            canProceed && scan.hasWarnings && 'bg-warning-muted text-warning',
            !canProceed && 'bg-destructive-muted text-destructive',
          )}
        >
          {canProceed
            ? scan.hasWarnings
              ? 'Ready to proceed with warnings. Review the items above before continuing.'
              : 'All checks passed. You are ready to root.'
            : 'One or more checks failed. Resolve them above, then rescan.'}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {scan ? (
          <>
            <Button
              className="w-full"
              disabled={!canProceed || isScanning}
              id="preflight-continue-btn"
              onClick={onContinue}
              size="sm"
              type="button"
            >
              Continue to Setup
            </Button>
            <RefreshButton
              className="w-full"
              isLoading={isScanning}
              label="Rescan checklist"
              loadingLabel="Scanning…"
              mode="action"
              onClick={onRescan}
            />
          </>
        ) : (
          <RefreshButton
            buttonVariant="default"
            className="w-full"
            isLoading={isScanning}
            label="Start Preflight Scan"
            loadingLabel="Scanning…"
            mode="action"
            onClick={onRescan}
          />
        )}
      </div>

      <p className="flex items-start gap-2 text-caption text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Cold boot starts the emulator without loading a saved state, so root changes persist. A
          normal boot restores a Quick Boot snapshot, which can overwrite the patch.
        </span>
      </p>
    </div>
  );
}
