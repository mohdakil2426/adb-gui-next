import type { LucideIcon } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <Empty className={cn('border-0 py-8', className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        {title && <EmptyTitle className="text-sm">{title}</EmptyTitle>}
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
