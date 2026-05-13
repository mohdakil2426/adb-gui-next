import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const STEPS = ['Preflight', 'Source', 'Manual', 'Rooting', 'Done'];

interface RootStepIndicatorProps {
  stepIndex: number;
}

export function RootStepIndicator({ stepIndex }: RootStepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, idx) => {
        const done = idx < stepIndex;
        const active = idx === stepIndex;
        return (
          <div className="flex items-center gap-2" key={label}>
            <div
              className={cn(
                'flex size-6 items-center justify-center rounded-full border font-semibold text-xs transition-colors',
                done && 'border-success bg-success text-success-foreground',
                active && 'border-primary bg-primary text-primary-foreground',
                !(done || active) && 'border-border bg-background text-muted-foreground',
              )}
            >
              {done ? <CheckCircle2 className="size-3.5" /> : idx + 1}
            </div>
            <span
              className={cn(
                'text-sm',
                active ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={cn('h-px w-8 transition-colors', done ? 'bg-success' : 'bg-border')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
