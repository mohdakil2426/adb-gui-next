import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface AboutCardProps {
  children: ReactNode;
  className?: string | undefined;
  icon?: LucideIcon | undefined;
  title: string;
}

/** Hairline border plus one surface step — the same panel shape as the Dashboard. */
export function AboutCard({ children, className, icon: Icon, title }: AboutCardProps) {
  return (
    <Card
      className={cn(
        '@container flex h-full flex-col justify-between gap-3 rounded-lg border-border bg-surface py-4 shadow-none',
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
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3 px-4">
        {children}
      </CardContent>
    </Card>
  );
}
