import type { LucideIcon } from 'lucide-react';
import { CopyButton } from '@/shared/components/CopyButton';

interface PayloadDumperSpecBadgeProps {
  copyValue?: string | undefined;
  icon: LucideIcon;
  label: string;
  tooltip?: string | undefined;
  value: string;
}

export function PayloadDumperSpecBadge({
  copyValue,
  icon: Icon,
  label,
  tooltip,
  value,
}: PayloadDumperSpecBadgeProps) {
  return (
    <div
      className="group relative flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 transition-colors hover:bg-surface-raised/80"
      title={tooltip || value}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span className="truncate font-medium text-[12px] text-body text-foreground">
            {value}
          </span>
        </div>
      </div>
      {copyValue ? (
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton className="size-5" label={label} value={copyValue} />
        </div>
      ) : null}
    </div>
  );
}
