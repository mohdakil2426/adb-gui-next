import type { LucideIcon } from 'lucide-react';
import { CopyButton } from '@/shared/components/CopyButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

interface FlasherSpecBadgeProps {
  copyValue?: string | undefined;
  icon: LucideIcon;
  label: string;
  tooltip?: string | undefined;
  value: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | undefined;
}

export function FlasherSpecBadge({
  copyValue,
  icon: Icon,
  label,
  tooltip,
  value,
  variant = 'default',
}: FlasherSpecBadgeProps) {
  const content = (
    <div
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 transition-colors hover:border-border hover:bg-surface-raised/70',
        variant === 'success' && 'border-success/30 bg-success/5 hover:border-success/50',
        variant === 'warning' && 'border-warning/30 bg-warning/5 hover:border-warning/50',
        variant === 'destructive' &&
          'border-destructive/30 bg-destructive/5 hover:border-destructive/50',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground',
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'destructive' && 'text-destructive',
          )}
        />
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span
            className={cn(
              'truncate font-medium font-mono text-foreground text-mono-sm',
              variant === 'success' && 'text-success',
              variant === 'warning' && 'text-warning',
              variant === 'destructive' && 'text-destructive',
            )}
          >
            {value}
          </span>
        </div>
      </div>

      {copyValue ? (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton value={copyValue} />
        </div>
      ) : null}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-caption">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
