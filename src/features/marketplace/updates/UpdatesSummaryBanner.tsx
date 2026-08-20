import { ArrowUpCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Progress } from '@/shared/ui/progress';

interface UpdatesSummaryBannerProps {
  batchProgress: number;
  isBatchUpdating: boolean;
  onUpdateAll: () => void;
  target: InstallTarget;
  updatableCount: number;
}

export function UpdatesSummaryBanner({
  batchProgress,
  isBatchUpdating,
  onUpdateAll,
  target,
  updatableCount,
}: UpdatesSummaryBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised/40 p-4.5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised p-2 text-foreground">
            <Sparkles className="size-5.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-body text-foreground">Catalog Update Inspector</h2>
              {updatableCount > 0 ? (
                <Badge className="text-[10px]" variant="default">
                  {updatableCount} New Releases
                </Badge>
              ) : (
                <Badge className="gap-1 text-[10px]" variant="success">
                  <CheckCircle2 className="size-3" />
                  All Apps Up to Date
                </Badge>
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              Compares installed device package versions against upstream GitHub and F-Droid
              releases.
            </p>
          </div>
        </div>

        <Button
          className="h-8 gap-1.5 px-3.5 text-caption"
          disabled={updatableCount === 0 || isBatchUpdating || !target.canInstall}
          onClick={onUpdateAll}
          size="sm"
          type="button"
        >
          {isBatchUpdating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Updating ({batchProgress}%)...
            </>
          ) : (
            <>
              <ArrowUpCircle className="size-3.5" data-icon="inline-start" />
              Update All ({updatableCount})
            </>
          )}
        </Button>
      </div>

      {isBatchUpdating ? <Progress className="h-1.5" value={batchProgress} /> : null}
    </div>
  );
}
