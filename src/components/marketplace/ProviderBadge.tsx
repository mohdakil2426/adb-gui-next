import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';
import { GitBranch, Package, Store } from 'lucide-react';

type ProviderSource = backend.ProviderSource;

const PROVIDER_CONFIG: Record<ProviderSource, { label: string; icon: typeof GitBranch }> = {
  'F-Droid': {
    label: 'F-Droid',
    icon: Package,
  },
  GitHub: {
    label: 'GitHub',
    icon: GitBranch,
  },
  Aptoide: {
    label: 'Aptoide',
    icon: Store,
  },
};

interface ProviderBadgeProps {
  source: string;
  compact?: boolean;
  className?: string;
}

export function ProviderBadge({ source, compact = false, className }: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[source as ProviderSource];

  if (!config) {
    return (
      <Badge variant="outline" className={cn('gap-1 px-2 py-0.5 text-[10px]', className)}>
        {source}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-full border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3" />
      {!compact && <span>{config.label}</span>}
    </Badge>
  );
}
