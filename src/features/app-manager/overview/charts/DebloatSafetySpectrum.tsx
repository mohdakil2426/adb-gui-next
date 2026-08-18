import { ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';

interface DebloatSafetySpectrumProps {
  onOpenDebloat: () => void;
  tiers: {
    advanced: number;
    expert: number;
    recommended: number;
    unsafe: number;
  };
  totalPackages: number;
}

export function DebloatSafetySpectrum({
  onOpenDebloat,
  tiers,
  totalPackages,
}: DebloatSafetySpectrumProps) {
  const debloatableTotal = tiers.recommended + tiers.advanced + tiers.expert;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <h3 className="font-medium text-foreground text-label">Debloat Health & Safety</h3>
        </div>
        <span className="numeric font-medium text-caption text-emerald-500">
          {debloatableTotal} detected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col rounded-md border border-border bg-surface-raised p-2">
          <span className="text-caption text-muted-foreground">Safe to Remove</span>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="numeric font-semibold text-emerald-500 text-headline">
              {tiers.recommended}
            </span>
            <span className="text-caption text-muted-foreground">packages</span>
          </div>
        </div>

        <div className="flex flex-col rounded-md border border-border bg-surface-raised p-2">
          <span className="text-caption text-muted-foreground">Advanced / Care</span>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="numeric font-semibold text-amber-500 text-headline">
              {tiers.advanced}
            </span>
            <span className="text-caption text-muted-foreground">packages</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <ShieldAlert className="size-3.5 text-rose-500" />
          <span>{totalPackages - debloatableTotal} System Essential</span>
        </div>
        <Button
          className="h-7 gap-1 px-2.5 text-caption"
          onClick={onOpenDebloat}
          size="sm"
          variant="outline"
        >
          <span>Open Debloater</span>
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
