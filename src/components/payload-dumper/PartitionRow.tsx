import React from 'react';
import { CheckCircle2, HardDrive, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { ExtractionProgressBar } from './ExtractionProgressBar';
import { formatBytesNum } from '@/lib/utils';

interface PartitionRowProps {
  partition: { name: string; size: number; selected: boolean };
  index: number;
  isExtracting: boolean;
  isCompleted: boolean;
  progressPercent: number;
  showProgress: boolean;
  onToggle: (index: number) => void;
  disabled: boolean;
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
      onClick={() => !disabled && !isCompleted && onToggle(index)}
      role="checkbox"
      aria-checked={isCompleted ? true : partition.selected}
      aria-disabled={disabled || isCompleted}
      tabIndex={isCompleted || disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled && !isCompleted) {
          e.preventDefault();
          onToggle(index);
        }
      }}
      className={cn(
        'grid gap-2 px-4 py-3 text-sm transition-colors items-center',
        showProgress
          ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
          : 'grid-cols-[28px_minmax(0,1fr)_72px]',
        !disabled && !isCompleted && 'cursor-pointer hover:bg-muted/50',
        partition.selected && !isCompleted && 'bg-primary/5',
        isCompleted && 'bg-success/5',
      )}
    >
      {/* Checkbox / completed */}
      {isCompleted ? (
        <CheckCircle2 className="h-5 w-5 text-success" />
      ) : (
        <CheckboxItem checked={partition.selected} disabled={disabled} />
      )}

      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        {isExtracting && !isCompleted ? (
          <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />
        ) : (
          <HardDrive
            className={cn(
              'h-4 w-4 shrink-0',
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
            'font-medium truncate',
            isCompleted
              ? 'text-success'
              : partition.selected
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {partition.name}
        </span>
      </div>

      {/* Progress — only when extraction active */}
      {showProgress && (
        <div className="flex items-center justify-center">
          <ExtractionProgressBar
            isExtracting={isExtracting}
            isCompleted={isCompleted}
            realProgress={progressPercent}
          />
        </div>
      )}

      {/* Size */}
      <span
        className={cn(
          'text-xs tabular-nums text-right',
          isCompleted ? 'text-success font-medium' : 'text-muted-foreground',
        )}
      >
        {formatBytesNum(partition.size)}
      </span>
    </div>
  );
});
