import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";

import {
  ALL_REMOVAL_TIERS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from "./debloater-utils";

const DISPLAY_REMOVAL_TIERS = ALL_REMOVAL_TIERS.filter((t) => t !== "Unlisted");

export const SafetyTierLegend = ({ expertMode }: { expertMode: boolean }) => (
  <section
    aria-label="Safety tier reference"
    className="border-border bg-surface flex flex-col gap-2.5 rounded-lg border p-3 shadow-none"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <ShieldCheck aria-hidden="true" className="text-muted-foreground size-3.5" />
        <h3 className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Universal Android Debloater (UAD) Safety Classification
        </h3>
      </div>

      <Badge className="text-[10px]" variant="neutral">
        UAD Community Standard
      </Badge>
    </div>

    {/* 4-Column responsive risk level grid */}
    <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-4">
      {DISPLAY_REMOVAL_TIERS.map((tier) => (
        <div
          className="border-border/50 bg-surface-raised/40 flex flex-col gap-1 rounded-md border p-2"
          key={tier}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "py-0.2 inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-medium",
                REMOVAL_TIER_CLASSES[tier].badge
              )}
            >
              <span
                aria-hidden="true"
                className={cn("size-1.2 rounded-full", REMOVAL_TIER_CLASSES[tier].dot)}
              />
              {REMOVAL_TIER_LABELS[tier]}
            </span>
          </div>
          <span className="text-caption text-muted-foreground leading-snug">
            {REMOVAL_TIER_MEANINGS[tier]}
          </span>
        </div>
      ))}
    </div>

    {expertMode ? (
      <div className="border-warning/40 bg-warning-muted/40 text-caption text-warning flex items-center gap-2 rounded-md border px-2.5 py-1.5">
        <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="font-medium">
          Expert Mode is active — Unsafe packages can now be selected. Ensure you create a state
          snapshot before debloating.
        </span>
      </div>
    ) : null}
  </section>
);
