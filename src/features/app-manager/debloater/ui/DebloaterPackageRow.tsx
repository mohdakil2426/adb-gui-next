import { EyeOff, Info, Loader2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
} from './debloaterUtils';

interface DebloaterPackageRowProps {
  currentPackageName: string | null;
  disableMode: boolean;
  expertMode: boolean;
  isPending: boolean;
  isSelected: boolean;
  onCurrentPackageNameChange: (name: string) => void;
  onSelectToggle: (name: string) => void;
  onSingleAction?:
    | ((pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => void)
    | undefined;
  pkg: backend.DebloatPackageRow;
  selectedSerial: string | null;
  size: number;
  start: number;
}

export function DebloaterPackageRow({
  currentPackageName,
  disableMode,
  expertMode,
  isPending,
  isSelected,
  onCurrentPackageNameChange,
  onSelectToggle,
  onSingleAction,
  pkg,
  selectedSerial,
  size,
  start,
}: DebloaterPackageRowProps) {
  const isCurrent = currentPackageName === pkg.name;
  const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

  return (
    <div
      aria-selected={isSelected}
      className={cn(
        'group absolute left-0 flex w-full cursor-pointer items-center justify-between gap-3 border-border/30 border-b px-3 py-1.5 outline-none transition-colors duration-90 ease-standard hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        isSelected && 'bg-primary-muted/40 hover:bg-primary-muted/60',
        isCurrent && !isSelected && 'bg-accent/80 ring-1 ring-border/80 ring-inset',
        isUnsafeBlocked && 'cursor-not-allowed opacity-65',
      )}
      onClick={() => {
        onCurrentPackageNameChange(pkg.name);
        if (!isUnsafeBlocked) {
          onSelectToggle(pkg.name);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onCurrentPackageNameChange(pkg.name);
          if (!isUnsafeBlocked) {
            onSelectToggle(pkg.name);
          }
        }
      }}
      role="option"
      style={{ height: `${size}px`, transform: `translateY(${start}px)` }}
      tabIndex={0}
    >
      {/* Left Column: Checkbox, State Dot & Metadata Stacks */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          aria-label={isSelected ? `Deselect ${pkg.name}` : `Select ${pkg.name}`}
          className="shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"
          disabled={isUnsafeBlocked}
          onClick={(e) => {
            e.stopPropagation();
            if (!isUnsafeBlocked) {
              onSelectToggle(pkg.name);
            }
          }}
          type="button"
        >
          <CheckboxItem checked={isSelected} disabled={isUnsafeBlocked} />
        </button>

        {/* State Dot indicator */}
        <span
          aria-label={PKG_STATE_LABELS[pkg.state]}
          className={cn(
            'size-2 shrink-0 rounded-full',
            PKG_STATE_CLASSES[pkg.state],
            pkg.state === 'Enabled' && 'shadow-[0_0_6px_rgba(34,197,94,0.4)]',
          )}
          role="img"
          title={PKG_STATE_LABELS[pkg.state]}
        />

        {/* 2-line info stack */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {/* Top Line: Package Name + Vendor Badge + Safety Tier */}
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium font-mono text-foreground text-mono">
              {pkg.name}
            </span>

            <Badge className="h-4.5 shrink-0 px-1.5 py-0 text-[10px]" variant="neutral">
              {pkg.list}
            </Badge>

            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.2 font-medium text-[10px]',
                REMOVAL_TIER_CLASSES[pkg.removal].badge,
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-1.2 rounded-full', REMOVAL_TIER_CLASSES[pkg.removal].dot)}
              />
              {REMOVAL_TIER_LABELS[pkg.removal]}
            </span>
          </div>

          {/* Bottom Line: Description snippet + dependencies */}
          <div className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
            <span className="truncate">
              {pkg.description || 'No description available in UAD database'}
            </span>

            {pkg.neededBy.length > 0 ? (
              <span className="shrink-0 font-medium text-[10px] text-warning">
                Needed by {pkg.neededBy.length}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right Column: 1-Click Action Buttons & Details Inspector */}
      <div className="flex shrink-0 items-center gap-1.5">
        {pkg.state === 'Enabled' ? (
          disableMode ? (
            <Button
              aria-busy={isPending}
              className="h-7 gap-1 border-border/80 px-2.5 text-caption hover:border-warning/50 hover:bg-warning-muted hover:text-warning"
              disabled={isUnsafeBlocked || isPending || !selectedSerial}
              onClick={() => onSingleAction?.(pkg, 'disable')}
              size="sm"
              title={
                isUnsafeBlocked
                  ? 'Expert mode required to disable Unsafe packages'
                  : 'Disable this package'
              }
              type="button"
              variant="outline"
            >
              {isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                  <span className="sr-only" role="status">
                    Disabling {pkg.name}…
                  </span>
                </>
              ) : (
                <EyeOff aria-hidden="true" className="size-3" />
              )}
              <span>Disable</span>
            </Button>
          ) : (
            <Button
              aria-busy={isPending}
              className="h-7 gap-1 border-border/80 px-2.5 text-caption hover:border-destructive/50 hover:bg-destructive-muted hover:text-destructive"
              disabled={isUnsafeBlocked || isPending || !selectedSerial}
              onClick={() => onSingleAction?.(pkg, 'uninstall')}
              size="sm"
              title={
                isUnsafeBlocked
                  ? 'Expert mode required to uninstall Unsafe packages'
                  : 'Uninstall this package'
              }
              type="button"
              variant="outline"
            >
              {isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                  <span className="sr-only" role="status">
                    Uninstalling {pkg.name}…
                  </span>
                </>
              ) : (
                <Trash2 aria-hidden="true" className="size-3" />
              )}
              <span>Uninstall</span>
            </Button>
          )
        ) : pkg.state === 'Disabled' ? (
          <Button
            aria-busy={isPending}
            className="h-7 gap-1 border-border/80 px-2.5 text-caption hover:border-success/50 hover:bg-success-muted hover:text-success"
            disabled={isPending || !selectedSerial}
            onClick={() => onSingleAction?.(pkg, 'restore')}
            size="sm"
            title="Re-enable this package"
            type="button"
            variant="outline"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                <span className="sr-only" role="status">
                  Enabling {pkg.name}…
                </span>
              </>
            ) : (
              <RotateCcw aria-hidden="true" className="size-3" />
            )}
            <span>Enable</span>
          </Button>
        ) : (
          <Button
            aria-busy={isPending}
            className="h-7 gap-1 border-border/80 px-2.5 text-caption hover:border-success/50 hover:bg-success-muted hover:text-success"
            disabled={isPending || !selectedSerial}
            onClick={() => onSingleAction?.(pkg, 'restore')}
            size="sm"
            title="Restore this uninstalled package"
            type="button"
            variant="outline"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                <span className="sr-only" role="status">
                  Restoring {pkg.name}…
                </span>
              </>
            ) : (
              <Undo2 aria-hidden="true" className="size-3" />
            )}
            <span>Restore</span>
          </Button>
        )}
        {/* Inspect Details trigger */}
        <Button
          aria-label={`Inspect ${pkg.name}`}
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onCurrentPackageNameChange(pkg.name)}
          size="icon"
          title="Inspect package telemetry"
          type="button"
          variant="ghost"
        >
          <Info aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
