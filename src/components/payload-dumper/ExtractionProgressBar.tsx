import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ExtractionProgressBarProps {
  isExtracting: boolean;
  isCompleted: boolean;
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
  if (!isExtracting && !isCompleted) return null;

  return (
    <div className="flex items-center gap-2 w-full">
      <Progress
        value={displayProgress}
        className={cn('flex-1 h-1.5', isCompleted ? '[&>div]:bg-success' : '')}
      />
      <span
        className={cn(
          'text-[10px] font-medium tabular-nums w-8 text-right shrink-0',
          isCompleted ? 'text-success' : 'text-primary',
        )}
      >
        {Math.round(displayProgress)}%
      </span>
    </div>
  );
}
