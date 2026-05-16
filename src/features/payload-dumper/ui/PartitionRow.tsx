import { CheckCircle2, HardDrive, Loader2 } from 'lucide-react';
import React from 'react';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { cn } from '@/shared/utils/cn';
import { formatBytesNum } from '@/shared/utils/formatting';
import { ExtractionProgressBar } from './ExtractionProgressBar';

interface PartitionRowProps {
  disabled: boolean;
  index: number;
  isCompleted: boolean;
  isExtracting: boolean;
  onToggle: (index: number) => void;
  partition: { name: string; size: number; selected: boolean };
  progressPercent: number;
  showProgress: boolean;
}

/**
 * Single partition row in the partition table.
 * Memoized to prevent unnecessary re-renders when other rows update.
 */
export const PartitionRow = React.memo(function PartitionRow({
  partition,
  index,
  isExtracting,
  isCompleted,
  progressPercent,
  showProgress,
  onToggle,
  disabled,
}: PartitionRowProps) {
  return (
    <div
      aria-checked={isCompleted ? true : partition.selected}
      aria-disabled={disabled || isCompleted}
      className={cn(
        'grid items-center gap-2 px-4 py-3 text-sm transition-colors',
        showProgress
          ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
          : 'grid-cols-[28px_minmax(0,1fr)_72px]',
        !(disabled || isCompleted) && 'cursor-pointer hover:bg-muted/50',
        partition.selected && !isCompleted && 'bg-primary/5',
        isCompleted && 'bg-success/5',
      )}
      onClick={() => {
        if (!(disabled || isCompleted)) {
          onToggle(index);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled && !isCompleted) {
          e.preventDefault();
          onToggle(index);
        }
      }}
      role="checkbox"
      tabIndex={isCompleted || disabled ? -1 : 0}
    >
      {/* Checkbox / completed */}
      {isCompleted ? (
        <CheckCircle2 className="size-5 text-success" />
      ) : (
        <CheckboxItem checked={partition.selected} disabled={disabled} />
      )}

      {/* Name */}
      <div className="flex min-w-0 items-center gap-2">
        {isExtracting && !isCompleted ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <HardDrive
            className={cn(
              'size-4 shrink-0',
              isCompleted
                ? 'text-success'
                : partition.selected
                  ? 'text-primary'
                  : 'text-muted-foreground',
            )}
          />
        )}
        <span
          className={cn(
            'whitespace-normal break-words font-medium leading-snug',
            isCompleted
              ? 'text-success'
              : partition.selected
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {partition.name}.img
        </span>
      </div>

      {/* Progress — only when extraction active */}
      {showProgress ? (
        <div className="flex items-center justify-center">
          <ExtractionProgressBar
            isCompleted={isCompleted}
            isExtracting={isExtracting}
            realProgress={progressPercent}
          />
        </div>
      ) : null}

      {/* Size */}
      <span
        className={cn(
          'text-right text-xs tabular-nums',
          isCompleted ? 'font-medium text-success' : 'text-muted-foreground',
        )}
      >
        {formatBytesNum(partition.size)}
      </span>
    </div>
  );
});
