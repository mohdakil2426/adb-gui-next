import { m, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface PanelCardProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  contentClassName?: string | undefined;
  /** Seconds to wait before the entrance plays — stagger siblings in a row. */
  delay?: number | undefined;
  icon: LucideIcon;
  title: string;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * The shared dashboard panel shell: equal-height card, quiet uppercase header,
 * hover lift, and a one-shot rise-and-fade entrance staggered via `delay`.
 */
export function PanelCard({
  action,
  children,
  className,
  contentClassName,
  delay = 0,
  icon: Icon,
  title,
}: PanelCardProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.32, delay, ease: EASE_STANDARD }
      }
      whileHover={shouldReduceMotion ? { y: 0 } : { y: -2 }}
      whileTap={shouldReduceMotion ? { scale: 1 } : { scale: 0.99 }}
    >
      <Card
        className={cn(
          '@container flex h-full flex-1 flex-col justify-between gap-3 rounded-xl border-border bg-surface py-4 shadow-none transition-colors duration-150',
          className,
        )}
      >
        <CardHeader className="gap-0 px-4.5 pb-0.5">
          <CardTitle
            as="h2"
            className="flex items-center gap-1.5 font-medium text-caption text-muted-foreground uppercase tracking-wider"
          >
            <Icon aria-hidden="true" className="size-3.5" />
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
    </m.div>
  );
}
