import type { ComponentType } from "react";

import { cn } from "@/shared/utils/cn";

interface SpecChipProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Optional tone class for the value (defaults to foreground). */
  valueClass?: string | undefined;
}

/**
 * The one micro-metric cell shared by the three vitals panels, so Battery,
 * Memory and Storage keep identical chip geometry on the same baseline.
 */
export const SpecChip = ({ icon: Icon, label, value, valueClass }: SpecChipProps) => (
  <div className="border-border/60 bg-surface-raised/40 text-caption hover:bg-surface-raised/80 flex items-center gap-2 rounded-lg border p-2 transition-colors">
    <Icon aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
    <div className="flex min-w-0 flex-col">
      <span className="text-caption text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </span>
      <span
        className={cn("text-foreground text-mono-sm truncate font-mono font-medium", valueClass)}
      >
        {value}
      </span>
    </div>
  </div>
);
