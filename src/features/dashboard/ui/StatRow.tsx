import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface StatRowProps {
  /** Secondary line under the value (patch age, health, free space). */
  hint?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  label: string;
  /** `true` for byte counts, percentages and other digits that update. */
  numeric?: boolean | undefined;
  value: ReactNode;
  valueClassName?: string | undefined;
}

/** Label left, value right — the reading order for a spec sheet. */
export function StatRow({ hint, icon, label, numeric, value, valueClassName }: StatRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="flex min-w-0 items-center gap-2 text-label text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex min-w-0 flex-col items-end">
        <span
          className={cn(
            'truncate text-right font-medium text-foreground',
            numeric && 'numeric',
            valueClassName,
          )}
        >
          {value}
        </span>
        {hint ? (
          <span className={cn('truncate text-caption text-muted-foreground', numeric && 'numeric')}>
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
