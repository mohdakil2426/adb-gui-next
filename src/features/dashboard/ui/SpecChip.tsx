import type { ComponentType } from 'react';
import { cn } from '@/shared/utils/cn';

interface SpecChipProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Optional tone class for the value (defaults to foreground). */
  valueClass?: string | undefined;
}

/**
 * The one micro-metric cell shared by the three vitals panels, so Battery,
 * Memory and Storage keep identical chip geometry on the same baseline.
 */
export function SpecChip({ icon: Icon, label, value, valueClass }: SpecChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption transition-colors hover:bg-surface-raised/80">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-caption text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span
          className={cn('truncate font-medium font-mono text-foreground text-mono-sm', valueClass)}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
