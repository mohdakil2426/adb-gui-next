import type { backend } from "@/lib/desktop/models";
import { cn } from "@/lib/utils";
import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
} from "./debloaterUtils";

interface DescriptionPanelProps {
  pkg: backend.DebloatPackageRow | null;
}

export function DescriptionPanel({ pkg }: DescriptionPanelProps) {
  if (!pkg) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a package to see details.
      </div>
    );
  }

  const tierClasses = REMOVAL_TIER_CLASSES[pkg.removal];
  const stateClass = PKG_STATE_CLASSES[pkg.state];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium font-mono text-foreground">
          {pkg.name}
        </span>
        {/* State dot + label */}
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span
            className={cn("inline-block size-2 rounded-full", stateClass)}
          />
          {PKG_STATE_LABELS[pkg.state]}
        </span>
        {/* Safety badge */}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[10px]",
            tierClasses.badge
          )}
        >
          {REMOVAL_TIER_LABELS[pkg.removal]}
        </span>
        {/* List badge */}
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground">
          {pkg.list}
        </span>
      </div>

      {pkg.description ? (
        <p className="text-muted-foreground leading-relaxed">
          {pkg.description}
        </p>
      ) : (
        <p className="text-muted-foreground italic">
          No description available.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
        <span>
          <span className="font-medium text-foreground">Dependencies:</span>{" "}
          {pkg.dependencies.length > 0 ? pkg.dependencies.join(", ") : "none"}
        </span>
        <span>
          <span className="font-medium text-foreground">Needed by:</span>{" "}
          {pkg.neededBy.length > 0 ? pkg.neededBy.join(", ") : "none"}
        </span>
      </div>
    </div>
  );
}
