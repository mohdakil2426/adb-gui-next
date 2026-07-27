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
 *
 * `@container`: every panel queries its *own* column width, not the viewport —
 * the dashboard grid's column count changes with the sidebar collapse state,
 * so a fixed `sm:`/`md:` breakpoint would be wrong at the exact same window size.
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
        '@container gap-3 rounded-lg border-border bg-surface py-4 shadow-none',
        className,
      )}
    >
      <CardHeader className="gap-0 px-4">
        <CardTitle
          as="h2"
          className="flex items-center gap-1.5 text-caption text-muted-foreground uppercase tracking-wide"
        >
          {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
          {title}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn('px-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
