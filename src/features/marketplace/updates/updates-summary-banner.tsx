import { ArrowUpCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import type { InstallTarget } from "@/features/marketplace/model/install-target";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";

interface UpdatesSummaryBannerProps {
  batchProgress: number;
  isBatchUpdating: boolean;
  onUpdateAll: () => void;
  target: InstallTarget;
  updatableCount: number;
}

export const UpdatesSummaryBanner = ({
  batchProgress,
  isBatchUpdating,
  onUpdateAll,
  target,
  updatableCount,
}: UpdatesSummaryBannerProps) => (
  <div className="border-border bg-surface-raised/40 flex flex-col gap-3 rounded-xl border p-4.5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="border-border/80 bg-surface-raised text-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl border p-2">
          <Sparkles className="text-primary size-5.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-body text-foreground font-semibold">Catalog Update Inspector</h2>
            {updatableCount > 0 ? (
              <Badge className="text-caption" variant="default">
                {updatableCount} New Releases
              </Badge>
            ) : (
              <Badge className="text-caption gap-1" variant="success">
                <CheckCircle2 className="size-3" />
                All Apps Up to Date
              </Badge>
            )}
          </div>
          <p className="text-caption text-muted-foreground">
            Compares installed device package versions against upstream GitHub and F-Droid releases.
          </p>
        </div>
      </div>

      <Button
        className="text-caption h-8 gap-1.5 px-3.5"
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
