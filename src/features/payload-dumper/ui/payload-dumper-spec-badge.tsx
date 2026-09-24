import type { LucideIcon } from "lucide-react";

import { CopyButton } from "@/shared/components/copy-button";

interface PayloadDumperSpecBadgeProps {
  copyValue?: string | undefined;
  icon: LucideIcon;
  label: string;
  tooltip?: string | undefined;
  value: string;
}

export const PayloadDumperSpecBadge = ({
  copyValue,
  icon: Icon,
  label,
  tooltip,
  value,
}: PayloadDumperSpecBadgeProps) => (
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
        <span className="text-foreground truncate text-xs font-medium">{value}</span>
      </div>
    </div>
    {copyValue ? (
      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton className="size-5" label={label} value={copyValue} />
      </div>
    ) : null}
  </div>
);
