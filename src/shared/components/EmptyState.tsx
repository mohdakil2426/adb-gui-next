import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { cn } from '@/shared/utils/cn';

interface EmptyStateProps {
  /** The one thing that resolves this state, offered inline. */
  action?: ReactNode;
  className?: string;
  description: string;
  icon?: LucideIcon;
  title?: string;
  /** `danger` tints the media badge — for a state caused by a failure, not by absence. */
  tone?: 'neutral' | 'danger';
}

/**
 * The compact in-card empty state, built on the shared `Empty` primitive so it
 * matches the full-page onboarding screen. Borderless by default — the card
 * around it already draws the boundary.
 */
export function EmptyState({
  action,
  icon: Icon,
  title,
  description,
  className,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <Empty className={cn('border-0 py-8', className)}>
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia
            className={tone === 'danger' ? 'bg-destructive-muted text-destructive' : undefined}
            variant="icon"
          >
            <Icon aria-hidden="true" />
          </EmptyMedia>
        ) : null}
        {title ? <EmptyTitle>{title}</EmptyTitle> : null}
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
