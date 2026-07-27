import { Progress } from '@/shared/ui/progress';
import { cn } from '@/shared/utils/cn';
import { EMPTY_VALUE } from '@/shared/utils/format';

interface ExtractionProgressBarProps {
  isCompleted: boolean;
  isExtracting: boolean;
  isFailed?: boolean;
  realProgress?: number;
}

/**
 * Extraction progress indicator using shadcn Progress component.
 * Shows percentage with color coding: green completed, primary in-progress, red failed.
 */
export function ExtractionProgressBar({
  isExtracting,
  isCompleted,
  isFailed = false,
  realProgress,
}: ExtractionProgressBarProps) {
  const displayProgress = isCompleted ? 100 : (realProgress ?? 0);
  if (!(isExtracting || isCompleted || isFailed)) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Progress
        className={cn(
          'h-1.5 flex-1',
          isCompleted && '[&>div]:bg-success',
          isFailed && '[&>div]:bg-destructive',
        )}
        value={isFailed && displayProgress === 0 ? 100 : displayProgress}
      />
      <span
        className={cn(
          'numeric w-9 shrink-0 text-right text-caption',
          isCompleted ? 'text-success' : isFailed ? 'text-destructive' : 'text-primary',
        )}
      >
        {isFailed && displayProgress === 0 ? EMPTY_VALUE : `${Math.round(displayProgress)}%`}
      </span>
    </div>
  );
}
