import { EyeOff, Loader2, Package, Shield, ShieldAlert, Trash2, Undo2, X } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { CopyButton } from '@/shared/components/CopyButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from './debloaterUtils';

interface DescriptionPanelProps {
  disableMode?: boolean;
  expertMode?: boolean;
  isPending?: boolean;
  onClose?: () => void;
  onSingleAction?: (pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => void;
  pkg: backend.DebloatPackageRow;
  selectedSerial?: string | null;
}

export function DescriptionPanel({
  disableMode = false,
  expertMode = false,
  isPending = false,
  onClose,
  onSingleAction,
  pkg,
  selectedSerial,
}: DescriptionPanelProps) {
  const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

  return (
    <section
      aria-label={`Package telemetry: ${pkg.name}`}
      aria-live="polite"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
    >
      {/* ── Top Header Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-b pb-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Package aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="font-bold font-mono text-foreground text-title">{pkg.name}</span>
          </div>

          <CopyButton aria-label="Copy package name" value={pkg.name} />

          {/* State Badge */}
          <Badge className="gap-1.5 px-2 py-0.5" variant="secondary">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                PKG_STATE_CLASSES[pkg.state],
                pkg.state === 'Enabled' && 'shadow-[0_0_4px_rgba(34,197,94,0.4)]',
              )}
            />
            {PKG_STATE_LABELS[pkg.state]}
          </Badge>
          {/* Safety Tier Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-caption',
              REMOVAL_TIER_CLASSES[pkg.removal].badge,
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', REMOVAL_TIER_CLASSES[pkg.removal].dot)}
            />
            {REMOVAL_TIER_LABELS[pkg.removal]}
          </span>

          {/* List/Vendor Badge */}
          <Badge className="font-mono text-caption" variant="neutral">
            {pkg.list}
          </Badge>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-1.5">
          {pkg.state === 'Enabled' ? (
            disableMode ? (
              <Button
                className="h-8 gap-1.5 border-border px-3 text-caption hover:border-warning/50 hover:bg-warning-muted hover:text-warning"
                disabled={isUnsafeBlocked || isPending || !selectedSerial}
                onClick={() => onSingleAction?.(pkg, 'disable')}
                size="sm"
                type="button"
                variant="outline"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                    data-icon="inline-start"
                    role="status"
                  />
                ) : (
                  <EyeOff aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                )}
                Disable Package
              </Button>
            ) : (
              <Button
                className="h-8 gap-1.5 border-border px-3 text-caption hover:border-destructive/50 hover:bg-destructive-muted hover:text-destructive"
                disabled={isUnsafeBlocked || isPending || !selectedSerial}
                onClick={() => onSingleAction?.(pkg, 'uninstall')}
                size="sm"
                type="button"
                variant="outline"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                    data-icon="inline-start"
                    role="status"
                  />
                ) : (
                  <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                )}
                Uninstall Package
              </Button>
            )
          ) : (
            <Button
              className="h-8 gap-1.5 border-border px-3 text-caption hover:border-success/50 hover:bg-success-muted hover:text-success"
              disabled={isPending || !selectedSerial}
              onClick={() => onSingleAction?.(pkg, 'restore')}
              size="sm"
              type="button"
              variant="outline"
            >
              {isPending ? (
                <Loader2
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                  data-icon="inline-start"
                  role="status"
                />
              ) : (
                <Undo2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              )}
              {pkg.state === 'Disabled' ? 'Re-enable Package' : 'Restore Package'}
            </Button>
          )}

          {onClose ? (
            <Button
              aria-label="Close details"
              className="size-8 text-muted-foreground hover:text-foreground"
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
          'flex items-start gap-2 rounded-md border px-3 py-2 text-caption',
          pkg.removal === 'Recommended' && 'border-success/30 bg-success-muted/50 text-success',
          pkg.removal === 'Advanced' && 'border-info/30 bg-info-muted/50 text-info',
          pkg.removal === 'Expert' && 'border-warning/30 bg-warning-muted/50 text-warning',
          pkg.removal === 'Unsafe' &&
            'border-destructive/30 bg-destructive-muted/50 text-destructive',
          pkg.removal === 'Unlisted' && 'border-border bg-muted/40 text-muted-foreground',
        )}
      >
        {pkg.removal === 'Unsafe' || pkg.removal === 'Expert' ? (
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
      <div className="flex flex-col gap-1 rounded-md border border-border/50 bg-surface-raised/40 p-2.5">
        <span className="font-semibold text-caption text-muted-foreground uppercase tracking-wider">
          Package Description (UAD Database)
        </span>
        <p className="text-body text-foreground/90 leading-relaxed">
          {pkg.description ||
            'This package has not yet been documented in the Universal Android Debloater community database. Review dependencies below prior to modifying.'}
        </p>
      </div>

      {/* ── Dependencies & Dependents Grid ── */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-2.5">
        <div className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-surface-raised/30 p-2.5">
          <span className="font-medium text-caption text-muted-foreground">
            Depends on ({pkg.dependencies.length})
          </span>
          {pkg.dependencies.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {pkg.dependencies.map((dep) => (
                <Badge className="font-mono text-[10px]" key={dep} variant="neutral">
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

        <div className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-surface-raised/30 p-2.5">
          <span className="font-medium text-caption text-muted-foreground">
            Needed by ({pkg.neededBy.length})
          </span>
          {pkg.neededBy.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {pkg.neededBy.map((dep) => (
                <Badge
                  className="border-warning/30 bg-warning-muted/40 font-mono text-[10px] text-warning"
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
}
