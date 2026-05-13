import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ExtractionProgressBarProps {
  isCompleted: boolean;
  isExtracting: boolean;
  realProgress?: number;
}

/**
 * Extraction progress indicator using shadcn Progress component.
 * Shows percentage with color coding: green for completed, primary for in-progress.
 */
export function ExtractionProgressBar({
  isExtracting,
  isCompleted,
  realProgress,
}: ExtractionProgressBarProps) {
  const displayProgress = isCompleted ? 100 : (realProgress ?? 0);
  if (!(isExtracting || isCompleted)) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Progress
        className={cn('h-1.5 flex-1', isCompleted ? '[&>div]:bg-success' : '')}
        value={displayProgress}
      />
      <span
        className={cn(
          'w-8 shrink-0 text-right font-medium text-[10px] tabular-nums',
          isCompleted ? 'text-success' : 'text-primary',
        )}
      >
        {Math.round(displayProgress)}%
      </span>
    </div>
  );
}
