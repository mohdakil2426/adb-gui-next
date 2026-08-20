import { Package, Package2, Play, Settings, Square, Zap, ZapOff } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatBytes } from '@/shared/utils/format';

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

export function InstalledPackageRow({
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
  apkSizeBytes = pkg.apkSizeBytes ?? 0,
  targetSdk = pkg.targetSdk ?? 0,
}: InstalledPackageRowProps) {
  return (
    <div
      aria-selected={isSelected}
      className={cn(
        'group absolute left-0 flex w-full cursor-pointer select-none items-center gap-3 border-border/40 border-b px-3.5 outline-none transition-colors duration-90 ease-standard hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        isSelected && 'bg-primary-muted/70 hover:bg-primary-muted',
        isDisabled && 'opacity-65 hover:opacity-100',
      )}
      onClick={() => onToggle(pkg.name)}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onToggle(pkg.name);
        }
      }}
      role="option"
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
            className="size-7 rounded-md border border-border/40 object-cover shadow-xs"
            height={28}
            src={iconSrc}
            width={28}
          />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground shadow-xs">
            {pkg.packageType === 'system' ? (
              <Package2 aria-hidden="true" className="size-4 text-info" />
            ) : (
              <Package aria-hidden="true" className="size-4 text-primary" />
            )}
          </div>
        )}

        {/* Precision State Illumination Dot */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-surface',
            isDisabled ? 'bg-amber-500 shadow-xs' : 'bg-emerald-500 shadow-xs ring-emerald-500/20',
          )}
          title={isDisabled ? 'Disabled' : 'Active'}
        />
      </div>

      {/* App Label (Top) & Package Name Identifier (Bottom) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span
          className={cn(
            'truncate font-semibold text-body leading-tight',
            isDisabled
              ? 'text-muted-foreground line-through decoration-muted-foreground/50'
              : 'text-foreground',
          )}
        >
          {pkg.label || pkg.name}
        </span>
        <span className="truncate font-mono text-caption text-muted-foreground/80 leading-tight">
          {pkg.name}
        </span>
      </div>

      {/* Target SDK Badge Column */}
      <div className="@md:flex hidden w-20 shrink-0 justify-center">
        {targetSdk > 0 ? (
          <Badge
            className="border-border/60 font-mono text-[10px] text-muted-foreground"
            variant="neutral"
          >
            API {targetSdk}
          </Badge>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground/60">—</span>
        )}
      </div>

      {/* APK Storage Size Footprint Column */}
      <div className="@sm:flex hidden w-24 shrink-0 justify-end">
        <span className="numeric font-mono text-caption text-muted-foreground tabular-nums">
          {apkSizeBytes > 0 ? formatBytes(apkSizeBytes) : '—'}
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
            variant={pkg.packageType === 'user' ? 'secondary' : 'neutral'}
          >
            {pkg.packageType}
          </Badge>
        )}
      </div>

      {/* Inline Hover Action Buttons Column */}
      <div className="flex w-28 shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity duration-90 group-focus-within:opacity-100 group-hover:opacity-100">
        {isDisabled ? (
          onToggleEnable ? (
            <Button
              aria-label={`Enable ${pkg.label || pkg.name}`}
              className="size-7 p-0 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnable(pkg.name, true);
              }}
              size="icon"
              title="Enable App"
              type="button"
              variant="ghost"
            >
              <Zap aria-hidden="true" className="size-3.5 fill-current" />
            </Button>
          ) : null
        ) : (
          <>
            {onLaunch ? (
              <Button
                aria-label={`Launch ${pkg.label || pkg.name}`}
                className="size-7 p-0 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch(pkg.name);
                }}
                size="icon"
                title="Launch App"
                type="button"
                variant="ghost"
              >
                <Play aria-hidden="true" className="size-3.5 fill-current" />
              </Button>
            ) : null}

            {onForceStop ? (
              <Button
                aria-label={`Force stop ${pkg.label || pkg.name}`}
                className="size-7 p-0 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onForceStop(pkg.name);
                }}
                size="icon"
                title="Force Stop"
                type="button"
                variant="ghost"
              >
                <Square aria-hidden="true" className="size-3.5 fill-current" />
              </Button>
            ) : null}

            {onToggleEnable ? (
              <Button
                aria-label={`Disable ${pkg.label || pkg.name}`}
                className="size-7 p-0 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEnable(pkg.name, false);
                }}
                size="icon"
                title="Disable App"
                type="button"
                variant="ghost"
              >
                <ZapOff aria-hidden="true" className="size-3.5" />
              </Button>
            ) : null}
          </>
        )}

        {onInspect ? (
          <Button
            aria-label={`Inspect ${pkg.label || pkg.name} details`}
            className="size-7 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(pkg.name);
            }}
            size="icon"
            title="Inspect Package Details"
            type="button"
            variant="ghost"
          >
            <Settings aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
