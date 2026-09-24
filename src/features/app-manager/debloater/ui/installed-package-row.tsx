import { Package, Package2, Play, Settings, Square, Zap, ZapOff } from "lucide-react";

import type { backend } from "@/desktop/models";
import { CheckboxItem } from "@/shared/components/checkbox-item";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";

export interface InstalledPackageRowProps {
  apkSizeBytes?: number | undefined;
  height: number;
  iconSrc: string | undefined;
  isDisabled?: boolean;
  isSelected: boolean;
  onForceStop?: ((name: string) => void) | undefined;
  onInspect?: ((name: string) => void) | undefined;
  onLaunch?: ((name: string) => void) | undefined;
  onToggle: (name: string) => void;
  onToggleEnable?: ((name: string, enable: boolean) => void) | undefined;
  pkg: backend.InstalledPackage;
  start: number;
  targetSdk?: number | undefined;
}

interface InstalledPackageRowActionsProps {
  isDisabled: boolean;
  onForceStop?: ((name: string) => void) | undefined;
  onInspect?: ((name: string) => void) | undefined;
  onLaunch?: ((name: string) => void) | undefined;
  onToggleEnable?: ((name: string, enable: boolean) => void) | undefined;
  pkg: backend.InstalledPackage;
}

const InstalledPackageRowActions = ({
  isDisabled,
  onForceStop,
  onInspect,
  onLaunch,
  onToggleEnable,
  pkg,
}: InstalledPackageRowActionsProps) => {
  const appLabel = pkg.label || pkg.name;

  return (
    <div className="flex w-28 shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity duration-90 group-focus-within:opacity-100 group-hover:opacity-100">
      {isDisabled && onToggleEnable ? (
        <Button
          aria-label={`Enable ${appLabel}`}
          className="text-muted-foreground size-7 p-0 hover:bg-emerald-500/10 hover:text-emerald-500"
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnable(pkg.name, true);
          }}
          size="icon"
          title="Enable App"
          type="button"
          variant="ghost"
        >
          <Zap aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
        </Button>
      ) : null}

      {isDisabled ? null : (
        <>
          {onLaunch ? (
            <Button
              aria-label={`Launch ${appLabel}`}
              className="text-muted-foreground size-7 p-0 hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={(e) => {
                e.stopPropagation();
                onLaunch(pkg.name);
              }}
              size="icon"
              title="Launch App"
              type="button"
              variant="ghost"
            >
              <Play aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
            </Button>
          ) : null}

          {onForceStop ? (
            <Button
              aria-label={`Force stop ${appLabel}`}
              className="text-muted-foreground size-7 p-0 hover:bg-amber-500/10 hover:text-amber-500"
              onClick={(e) => {
                e.stopPropagation();
                onForceStop(pkg.name);
              }}
              size="icon"
              title="Force Stop"
              type="button"
              variant="ghost"
            >
              <Square
                aria-hidden="true"
                className="size-3.5 fill-current"
                data-icon="inline-start"
              />
            </Button>
          ) : null}

          {onToggleEnable ? (
            <Button
              aria-label={`Disable ${appLabel}`}
              className="text-muted-foreground size-7 p-0 hover:bg-amber-500/10 hover:text-amber-500"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnable(pkg.name, false);
              }}
              size="icon"
              title="Disable App"
              type="button"
              variant="ghost"
            >
              <ZapOff aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            </Button>
          ) : null}
        </>
      )}

      {onInspect ? (
        <Button
          aria-label={`Inspect ${appLabel} details`}
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary size-7 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(pkg.name);
          }}
          size="icon"
          title="Inspect Package Details"
          type="button"
          variant="ghost"
        >
          <Settings aria-hidden="true" className="size-3.5" data-icon="inline-start" />
        </Button>
      ) : null}
    </div>
  );
};

export const InstalledPackageRow = ({
  height,
  iconSrc,
  isDisabled = false,
  isSelected,
  onForceStop,
  onInspect,
  onLaunch,
  onToggle,
  onToggleEnable,
  pkg,
  start,
  apkSizeBytes: propApkSizeBytes,
  targetSdk: propTargetSdk,
}: InstalledPackageRowProps) => {
  const apkSizeBytes = propApkSizeBytes ?? pkg.apkSizeBytes ?? 0;
  const targetSdk = propTargetSdk ?? pkg.targetSdk ?? 0;

  return (
    <div
      aria-selected={isSelected}
      className={cn(
        "group border-border/40 ease-standard hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-ring absolute left-0 flex w-full cursor-pointer items-center gap-3 border-b px-3.5 transition-colors duration-90 outline-none select-none focus-visible:ring-1 focus-visible:ring-inset",
        isSelected && "bg-primary-muted/70 hover:bg-primary-muted",
        isDisabled && "opacity-65 hover:opacity-100"
      )}
      onClick={() => onToggle(pkg.name)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onToggle(pkg.name);
        }
      }}
      role="treeitem"
      style={{ height: `${height}px`, transform: `translateY(${start}px)` }}
      tabIndex={0}
    >
      {/* Multi-selection Checkbox */}
      <CheckboxItem checked={isSelected} />

      {/* App Icon with State Illumination Indicator */}
      <div className="relative flex size-7 shrink-0 items-center justify-center">
        {iconSrc ? (
          <img
            alt=""
            className="border-border/40 size-7 rounded-md border object-cover shadow-xs"
            height={28}
            src={iconSrc}
            width={28}
          />
        ) : (
          <div className="border-border/60 bg-muted/60 text-muted-foreground flex size-7 items-center justify-center rounded-md border shadow-xs">
            {pkg.packageType === "system" ? (
              <Package2 aria-hidden="true" className="text-info size-4" />
            ) : (
              <Package aria-hidden="true" className="text-primary size-4" />
            )}
          </div>
        )}

        {/* Precision State Illumination Dot */}
        <span
          aria-hidden="true"
          className={cn(
            "ring-surface absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2",
            isDisabled ? "bg-amber-500 shadow-xs" : "bg-emerald-500 shadow-xs ring-emerald-500/20"
          )}
          title={isDisabled ? "Disabled" : "Active"}
        />
      </div>

      {/* App Label (Top) & Package Name Identifier (Bottom) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span
          className={cn(
            "text-body truncate leading-tight font-semibold",
            isDisabled
              ? "text-muted-foreground decoration-muted-foreground/50 line-through"
              : "text-foreground"
          )}
        >
          {pkg.label || pkg.name}
        </span>
        <span className="text-caption text-muted-foreground/80 truncate font-mono leading-tight">
          {pkg.name}
        </span>
      </div>

      {/* Target SDK Badge Column */}
      <div className="hidden w-20 shrink-0 justify-center @md:flex">
        {targetSdk > 0 ? (
          <Badge
            className="border-border/60 text-muted-foreground font-mono text-[10px]"
            variant="neutral"
          >
            API {targetSdk}
          </Badge>
        ) : (
          <span className="text-muted-foreground/60 font-mono text-[10px]">—</span>
        )}
      </div>

      {/* APK Storage Size Footprint Column */}
      <div className="hidden w-24 shrink-0 justify-end @sm:flex">
        <span className="numeric text-caption text-muted-foreground font-mono tabular-nums">
          {apkSizeBytes > 0 ? formatBytes(apkSizeBytes) : "—"}
        </span>
      </div>
      {/* Package Type Badge Column */}
      <div className="flex w-20 shrink-0 justify-center">
        {isDisabled ? (
          <Badge className="text-[10px]" variant="warning">
            Disabled
          </Badge>
        ) : (
          <Badge
            className="text-[10px]"
            variant={pkg.packageType === "user" ? "secondary" : "neutral"}
          >
            {pkg.packageType}
          </Badge>
        )}
      </div>

      {/* Inline Hover Action Buttons Column */}
      <InstalledPackageRowActions
        isDisabled={isDisabled}
        onForceStop={onForceStop}
        onInspect={onInspect}
        onLaunch={onLaunch}
        onToggleEnable={onToggleEnable}
        pkg={pkg}
      />
    </div>
  );
};
