import type { LucideIcon } from "lucide-react";

import { CopyButton } from "@/shared/components/copy-button";
import { cn } from "@/shared/utils/cn";

interface EmulatorSpecBadgeProps {
  copyValue?: string | undefined;
  icon: LucideIcon;
  label: string;
  mono?: boolean;
  tooltip?: string | undefined;
  value: string;
}

export const EmulatorSpecBadge = ({
  copyValue,
  icon: Icon,
  label,
  mono,
  tooltip,
  value,
}: EmulatorSpecBadgeProps) => (
  <div
    className="group border-border/60 bg-surface-raised/40 hover:bg-surface-raised/80 relative flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors"
    title={tooltip || value}
  >
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
          {label}
        </span>
        <span
          className={cn(
            "text-body text-foreground truncate text-xs font-medium",
            mono && "text-mono font-mono"
          )}
        >
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
