import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * The single section label used inside cards and panels.
 *
 * Matches the Dashboard `PanelCard` title exactly (`text-caption`, uppercase,
 * muted) so a section divider reads the same everywhere — it is metadata, and
 * must stay quieter than the values underneath it.
 */
export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h4 className={cn('text-caption text-muted-foreground uppercase tracking-wide', className)}>
      {children}
    </h4>
  );
}
