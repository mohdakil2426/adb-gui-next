import { Check, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

const STEP_LABELS = [
  'Verify connection',
  'Locate ZIP index',
  'Detect format',
  'Read partition list',
] as const;

const PHASE_TO_STEP: Record<backend.PayloadLoadPhase, number> = {
  verifyConnection: 1,
  locateIndex: 2,
  detectFormat: 3,
  readPartitions: 4,
  done: 4,
  error: 0,
};

export interface RemoteLoadProgressCardProps {
  detail?: string | null;
  estimatedSizeLabel?: string | null;
  message?: string;
  onCancel: () => void;
  phase?: backend.PayloadLoadPhase | null;
  startedAt: number;
  step?: number;
  totalSteps?: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function resolveActiveStep(
  phase: backend.PayloadLoadPhase | null | undefined,
  step: number | undefined,
): number {
  if (phase && phase in PHASE_TO_STEP) {
    const fromPhase = PHASE_TO_STEP[phase];
    if (fromPhase > 0) {
      return fromPhase;
    }
  }
  if (typeof step === 'number' && step > 0) {
    return Math.min(step, 4);
  }
  return 1;
}

/**
 * In-panel remote load stages while listing partitions from a URL.
 * Indeterminate progress — not a full-file download.
 */
export function RemoteLoadProgressCard({
  phase = null,
  message,
  detail = null,
  step,
  totalSteps = 4,
  estimatedSizeLabel = null,
  startedAt,
  onCancel,
}: RemoteLoadProgressCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const activeStep = resolveActiveStep(phase, step);
  const isError = phase === 'error';
  const elapsedMs = now - startedAt;
  const elapsedLabel = formatElapsed(elapsedMs);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const statusLine =
    message?.trim() ||
    (isError ? 'Couldn’t read remote index.' : (STEP_LABELS[activeStep - 1] ?? 'Loading…'));

  let slowHint: string | null = null;
  if (!isError && elapsedMs > 45_000) {
    slowHint = 'Taking longer than usual. Check network or Cancel and retry.';
  } else if (!isError && elapsedMs > 15_000) {
    slowHint = 'Still working — large packages can take up to a minute.';
  }

  const sizeCopy = estimatedSizeLabel
    ? `Only reading index — not downloading full ${estimatedSizeLabel}`
    : 'Only reading the package index — not a full-file download';

  return (
    <div
      aria-busy={!isError}
      aria-live="polite"
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Loading partitions</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          Step {Math.min(activeStep, totalSteps)} of {totalSteps}
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const done = !isError && activeStep > stepNumber;
          const working = !isError && activeStep === stepNumber;
          const pending = !(done || working);
          return (
            <li className="flex min-w-0 items-center gap-2 text-sm" key={label}>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border font-medium text-[10px]',
                  done && 'border-success/40 bg-success/15 text-success',
                  working && 'border-primary/40 bg-primary/10 text-primary',
                  pending && 'border-border bg-background text-muted-foreground',
                  isError && stepNumber === activeStep && 'border-destructive/40 text-destructive',
                )}
              >
                {done ? <Check className="size-3" /> : null}
                {working ? <Loader2 className="size-3 animate-spin" /> : null}
                {pending ? stepNumber : null}
              </span>
              <span
                className={cn(
                  'min-w-0 truncate',
                  done && 'text-muted-foreground',
                  working && 'font-medium text-foreground',
                  pending && 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                {done ? 'done' : null}
                {working ? 'working' : null}
                {pending ? 'waiting' : null}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Indeterminate progress bar (not a percentage of full download) */}
      <div
        aria-hidden="true"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20"
      >
        {isError ? (
          <div className="h-full w-full bg-destructive/40" />
        ) : (
          <div className="h-full w-full origin-left animate-pulse bg-primary/70" />
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-muted-foreground">
          <span className="tabular-nums">{elapsedLabel}</span>
          <span className="mx-1 text-muted-foreground/50">·</span>
          {sizeCopy}
        </p>
        <p className={cn('font-medium', isError ? 'text-destructive' : 'text-foreground')}>
          {statusLine}
        </p>
        {detail ? (
          <p className="truncate text-muted-foreground" title={detail}>
            {detail}
          </p>
        ) : null}
        {slowHint ? <p className="text-warning">{slowHint}</p> : null}
      </div>

      <Button
        aria-label="Cancel loading partitions"
        className="w-full"
        onClick={onCancel}
        variant="destructive"
      >
        <XCircle aria-hidden="true" className="size-4" />
        Cancel loading
      </Button>
    </div>
  );
}
