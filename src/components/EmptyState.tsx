import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-2 py-8 text-center', className)}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/50" />}
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
