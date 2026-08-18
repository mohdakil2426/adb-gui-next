import { Loader2, Plus } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface PartitionInspectionBadgeProps {
  disabled: boolean;
  fileName: string;
  inspectInfo: backend.PartitionTargetInfo | null;
  isInspecting: boolean;
  onAddToQueue: () => void;
  partition: string;
}

export function PartitionInspectionBadge({
  fileName,
  partition,
  isInspecting,
  inspectInfo,
  disabled,
  onAddToQueue,
}: PartitionInspectionBadgeProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-surface-raised/40 p-2.5 text-caption">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Target file: <span className="font-mono text-foreground">{fileName}</span>
        </span>
        <Button
          className="h-6 gap-1 px-2 text-[11px]"
          disabled={disabled || !partition}
          onClick={onAddToQueue}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-3" />
          Queue in Batch
        </Button>
      </div>
      {isInspecting ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Inspecting image headers...</span>
        </div>
      ) : inspectInfo ? (
        <div className="flex flex-wrap items-center gap-2 border-border/40 border-t pt-1 text-[11px]">
          <Badge className="font-mono text-[10px]" variant="secondary">
            {inspectInfo.detectedPartition || partition}
          </Badge>
          {inspectInfo.confidence ? (
            <span className="text-muted-foreground">
              Match: <strong className="text-foreground">{inspectInfo.confidence}</strong>
            </span>
          ) : null}
          {inspectInfo.riskLevel ? (
            <Badge
              className="text-[9px] uppercase"
              variant={
                inspectInfo.riskLevel === 'critical'
                  ? 'destructive'
                  : inspectInfo.riskLevel === 'elevated'
                    ? 'default'
                    : 'outline'
              }
            >
              {inspectInfo.riskLevel}
            </Badge>
          ) : null}
          {inspectInfo.isSparse ? (
            <Badge className="text-[9px]" variant="outline">
              Sparse
            </Badge>
          ) : null}
          {inspectInfo.isSlotted ? (
            <Badge className="text-[9px]" variant="outline">
              A/B Slotted
            </Badge>
          ) : null}
          {inspectInfo.requiredMode ? (
            <Badge className="font-mono text-[9px]" variant="secondary">
              {inspectInfo.requiredMode}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
