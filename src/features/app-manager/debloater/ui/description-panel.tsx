import { EyeOff, Loader2, Package, Shield, ShieldAlert, Trash2, Undo2, X } from "lucide-react";

import type { backend } from "@/desktop/models";
import { CopyButton } from "@/shared/components/copy-button";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from "./debloater-utils";

interface DescriptionPanelProps {
  disableMode?: boolean;
  expertMode?: boolean;
  isPending?: boolean;
  onClose?: () => void;
  onSingleAction?:
    | ((pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => void)
    | undefined;
  pkg: backend.DebloatPackageRow;
  selectedSerial?: string | null;
}

interface DescriptionActionButtonProps {
  disableMode: boolean;
  expertMode: boolean;
  isPending: boolean;
  onSingleAction?:
    | ((pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => void)
    | undefined;
  pkg: backend.DebloatPackageRow;
  selectedSerial?: string | null | undefined;
}

const DescriptionActionButton = ({
  disableMode,
  expertMode,
  isPending,
  onSingleAction,
  pkg,
  selectedSerial,
}: DescriptionActionButtonProps) => {
  const isUnsafeBlocked = pkg.removal === "Unsafe" && !expertMode;

  if (pkg.state === "Enabled") {
    if (disableMode) {
      return (
        <Button
          className="border-border text-caption hover:border-warning/50 hover:bg-warning-muted hover:text-warning h-8 gap-1.5 px-3"
          disabled={isUnsafeBlocked || isPending || !selectedSerial}
          onClick={() => onSingleAction?.(pkg, "disable")}
          size="sm"
          type="button"
          variant="outline"
        >
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="size-3.5 animate-spin"
              data-icon="inline-start"
            />
          ) : (
            <EyeOff aria-hidden="true" className="size-3.5" data-icon="inline-start" />
          )}
          Disable Package
        </Button>
      );
    }

    return (
      <Button
        className="border-border text-caption hover:border-destructive/50 hover:bg-destructive-muted hover:text-destructive h-8 gap-1.5 px-3"
        disabled={isUnsafeBlocked || isPending || !selectedSerial}
        onClick={() => onSingleAction?.(pkg, "uninstall")}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" data-icon="inline-start" />
        ) : (
          <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
        )}
        Uninstall Package
      </Button>
    );
  }

  return (
    <Button
      className="border-border text-caption hover:border-success/50 hover:bg-success-muted hover:text-success h-8 gap-1.5 px-3"
      disabled={isPending || !selectedSerial}
      onClick={() => onSingleAction?.(pkg, "restore")}
      size="sm"
      type="button"
      variant="outline"
    >
      {isPending ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" data-icon="inline-start" />
      ) : (
        <Undo2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
      )}
      {pkg.state === "Disabled" ? "Re-enable Package" : "Restore Package"}
    </Button>
  );
};

export const DescriptionPanel = ({
  disableMode = false,
  expertMode = false,
  isPending = false,
  onClose,
  onSingleAction,
  pkg,
  selectedSerial,
}: DescriptionPanelProps) => (
  <section
    aria-label={`Package telemetry: ${pkg.name}`}
    aria-live="polite"
    className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4"
  >
    {/* ── Top Header Row ── */}
    <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Package aria-hidden="true" className="text-muted-foreground size-4" />
          <span className="text-foreground text-title font-mono font-bold">{pkg.name}</span>
        </div>

        <CopyButton aria-label="Copy package name" value={pkg.name} />

        {/* State Badge */}
        <Badge className="gap-1.5 px-2 py-0.5" variant="secondary">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              PKG_STATE_CLASSES[pkg.state],
              // oxlint-disable-next-line shadcn/no-arbitrary-values -- status indicator glow for enabled state
              pkg.state === "Enabled" && "shadow-[0_0_4px_rgba(34,197,94,0.4)]"
            )}
          />
          {PKG_STATE_LABELS[pkg.state]}
        </Badge>
        {/* Safety Tier Badge */}
        <span
          className={cn(
            "text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            REMOVAL_TIER_CLASSES[pkg.removal].badge
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", REMOVAL_TIER_CLASSES[pkg.removal].dot)}
          />
          {REMOVAL_TIER_LABELS[pkg.removal]}
        </span>

        {/* List/Vendor Badge */}
        <Badge className="text-caption font-mono" variant="neutral">
          {pkg.list}
        </Badge>
      </div>

      {/* Action Controls & Close */}
      <div className="flex items-center gap-1.5">
        <DescriptionActionButton
          disableMode={disableMode}
          expertMode={expertMode}
          isPending={isPending}
          onSingleAction={onSingleAction}
          pkg={pkg}
          selectedSerial={selectedSerial}
        />

        {onClose ? (
          <Button
            aria-label="Close details"
            className="text-muted-foreground hover:text-foreground size-8"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" data-icon="inline-start" />
          </Button>
        ) : null}
      </div>
    </div>

    {/* ── Safety Risk Guidance Callout ── */}
    <div
      className={cn(
        "text-caption flex items-start gap-2 rounded-md border px-3 py-2",
        pkg.removal === "Recommended" && "border-success/30 bg-success-muted/50 text-success",
        pkg.removal === "Advanced" && "border-info/30 bg-info-muted/50 text-info",
        pkg.removal === "Expert" && "border-warning/30 bg-warning-muted/50 text-warning",
        pkg.removal === "Unsafe" &&
          "border-destructive/30 bg-destructive-muted/50 text-destructive",
        pkg.removal === "Unlisted" && "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      {pkg.removal === "Unsafe" || pkg.removal === "Expert" ? (
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Shield aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">{REMOVAL_TIER_LABELS[pkg.removal]} Tier Guidance</span>
        <span>{REMOVAL_TIER_MEANINGS[pkg.removal]}</span>
      </div>
    </div>

    {/* ── Community Description ── */}
    <div className="border-border/50 bg-surface-raised/40 flex flex-col gap-1 rounded-md border p-2.5">
      <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
        Package Description (UAD Database)
      </span>
      <p className="text-body text-foreground/90 leading-relaxed">
        {pkg.description ||
          "This package has not yet been documented in the Universal Android Debloater community database. Review dependencies below prior to modifying."}
      </p>
    </div>

    {/* ── Dependencies & Dependents Grid ── */}
    <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
      <div className="border-border/50 bg-surface-raised/30 flex flex-col gap-1.5 rounded-md border p-2.5">
        <span className="text-caption text-muted-foreground font-medium">
          Depends on ({pkg.dependencies.length})
        </span>
        {pkg.dependencies.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {pkg.dependencies.map((dep) => (
              <Badge className="text-mono-sm font-mono" key={dep} variant="neutral">
                {dep}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-caption text-muted-foreground/70">
            No prerequisites or library dependencies declared.
          </span>
        )}
      </div>

      <div className="border-border/50 bg-surface-raised/30 flex flex-col gap-1.5 rounded-md border p-2.5">
        <span className="text-caption text-muted-foreground font-medium">
          Needed by ({pkg.neededBy.length})
        </span>
        {pkg.neededBy.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {pkg.neededBy.map((dep) => (
              <Badge
                className="border-warning/30 bg-warning-muted/40 text-warning text-mono-sm font-mono"
                key={dep}
                variant="outline"
              >
                {dep}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-caption text-muted-foreground/70">
            No known third-party or system services depend on this package.
          </span>
        )}
      </div>
    </div>
  </section>
);
