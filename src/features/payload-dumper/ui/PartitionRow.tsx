import { CheckCircle2, Clock, HardDrive, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import React from 'react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { cn } from '@/shared/utils/cn';
import { formatBytesNum } from '@/shared/utils/formatting';
import { ExtractionProgressBar } from './ExtractionProgressBar';

interface PartitionRowProps {
  disabled: boolean;
  extractStatus?: backend.PartitionExtractStatus | undefined;
  index: number;
  onToggle: (index: number) => void;
  partition: { name: string; size: number; selected: boolean };
  progressPercent: number;
  showProgress: boolean;
  throughputMbps?: number | undefined;
}

/**
 * Single partition row in the partition table.
 * Memoized to prevent unnecessary re-renders when other rows update.
 */
export const PartitionRow = React.memo(function PartitionRow({
  partition,
  index,
  extractStatus,
  progressPercent,
  throughputMbps,
  showProgress,
  onToggle,
  disabled,
}: PartitionRowProps) {
  const isCompleted = extractStatus === 'completed';
  const isFailed = extractStatus === 'failed';
  const isPending = extractStatus === 'pending';
  const isRunning = extractStatus === 'running';
  const isVerifying = extractStatus === 'verifying';
  const isActive = isPending || isRunning || isVerifying;
  const rowDisabled = disabled || isCompleted || isFailed;

  return (
    <div
      aria-checked={isCompleted ? true : partition.selected}
      aria-disabled={rowDisabled}
      className={cn(
        'grid items-center gap-2 px-4 py-3 text-sm transition-colors',
        showProgress
          ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
          : 'grid-cols-[28px_minmax(0,1fr)_72px]',
        !rowDisabled && 'cursor-pointer hover:bg-muted/50',
        partition.selected && !isCompleted && !isFailed && 'bg-primary/5',
        isCompleted && 'bg-success/5',
        isFailed && 'bg-destructive/5',
      )}
      onClick={() => {
        if (!rowDisabled) {
          onToggle(index);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !rowDisabled) {
          e.preventDefault();
          onToggle(index);
        }
      }}
      role="checkbox"
      tabIndex={rowDisabled ? -1 : 0}
    >
      {/* Checkbox / terminal status icon */}
      {isCompleted ? (
        <CheckCircle2 aria-label="Completed" className="size-5 text-success" />
      ) : isFailed ? (
        <XCircle aria-label="Failed" className="size-5 text-destructive" />
      ) : (
        <CheckboxItem checked={partition.selected} disabled={disabled} />
      )}

      {/* Name + status indicator */}
      <div className="flex min-w-0 items-center gap-2">
        <PartitionStatusIcon
          extractStatus={extractStatus}
          isCompleted={isCompleted}
          selected={partition.selected}
        />
        <span
          className={cn(
            'whitespace-normal break-words font-medium leading-snug',
            isCompleted
              ? 'text-success'
              : isFailed
                ? 'text-destructive'
                : partition.selected
                  ? 'text-foreground'
                  : 'text-muted-foreground',
          )}
        >
          {partition.name}.img
        </span>
        {extractStatus && showProgress ? (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide',
              statusBadgeClass(extractStatus),
            )}
          >
            {extractStatus}
          </span>
        ) : null}
      </div>

      {/* Progress — only when extraction active */}
      {showProgress ? (
        <div className="flex min-w-0 flex-col items-stretch justify-center gap-0.5">
          <ExtractionProgressBar
            isCompleted={isCompleted}
            isExtracting={isActive}
            isFailed={isFailed}
            realProgress={progressPercent}
          />
          {isRunning && throughputMbps != null && throughputMbps > 0 ? (
            <span className="text-center text-[10px] text-muted-foreground tabular-nums">
              {throughputMbps.toFixed(1)} MB/s
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Size */}
      <span
        className={cn(
          'text-right text-xs tabular-nums',
          isCompleted
            ? 'font-medium text-success'
            : isFailed
              ? 'font-medium text-destructive'
              : 'text-muted-foreground',
        )}
      >
        {formatBytesNum(partition.size)}
      </span>
    </div>
  );
});

function PartitionStatusIcon({
  extractStatus,
  isCompleted,
  selected,
}: {
  extractStatus?: backend.PartitionExtractStatus | undefined;
  isCompleted: boolean;
  selected: boolean;
}) {
  if (extractStatus === 'running') {
    return <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary" />;
  }
  if (extractStatus === 'verifying') {
    return (
      <ShieldCheck aria-hidden="true" className="size-4 shrink-0 animate-pulse text-primary" />
    );
  }
  if (extractStatus === 'pending') {
    return <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (extractStatus === 'failed') {
    return <XCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />;
  }
  return (
    <HardDrive
      aria-hidden="true"
      className={cn(
        'size-4 shrink-0',
        isCompleted ? 'text-success' : selected ? 'text-primary' : 'text-muted-foreground',
      )}
    />
  );
}

function statusBadgeClass(status: backend.PartitionExtractStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-success/15 text-success';
    case 'failed':
      return 'bg-destructive/15 text-destructive';
    case 'running':
      return 'bg-primary/15 text-primary';
    case 'verifying':
      return 'bg-primary/10 text-primary';
    case 'pending':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
