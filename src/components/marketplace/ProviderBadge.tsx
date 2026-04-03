import type { backend } from '@/lib/desktop/models';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ProviderSource = backend.ProviderSource;

const PROVIDER_CONFIG: Record<ProviderSource, { label: string; className: string; icon: string }> =
  {
    'F-Droid': {
      label: 'F-Droid',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
      icon: '🟦',
    },
    IzzyOnDroid: {
      label: 'Izzy',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      icon: '🟩',
    },
    GitHub: {
      label: 'GitHub',
      className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
      icon: '🟪',
    },
    Aptoide: {
      label: 'Aptoide',
      className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
      icon: '🟧',
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
      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', className)}>
        {source}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 font-medium border', config.className, className)}
    >
      {compact ? config.icon : config.label}
    </Badge>
  );
}
