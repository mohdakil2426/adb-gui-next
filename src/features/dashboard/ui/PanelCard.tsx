import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface PanelCardProps {
  /** Right-aligned control in the header (refresh, toggle, badge). */
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  contentClassName?: string | undefined;
  icon?: LucideIcon | undefined;
  title: string;
}

/**
 * One dashboard panel: hairline border and a surface step, never a shadow —
 * shadow is invisible on a near-black canvas. The title is caption-sized
 * metadata, so the numbers inside stay the loudest thing on the card.
 */
export function PanelCard({
  action,
  children,
  className,
  contentClassName,
  icon: Icon,
  title,
}: PanelCardProps) {
  return (
    <Card
      className={cn(
        '@container flex h-full flex-col justify-between gap-3 rounded-xl border-border bg-surface py-4 shadow-none transition-all duration-150',
        className,
      )}
    >
      <CardHeader className="gap-0 px-4.5 pb-0.5">
        <CardTitle
          as="h2"
          className="flex items-center gap-1.5 font-medium text-caption text-muted-foreground uppercase tracking-wider"
        >
          {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
          {title}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent
        className={cn('flex flex-1 flex-col justify-between gap-3 px-4.5 pt-1', contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}
