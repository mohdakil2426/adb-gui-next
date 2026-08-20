import { HardDrive, ListOrdered, Loader2, Trash2, X, Zap } from 'lucide-react';
import type { BatchPartitionItem } from '@/features/flasher/model/flasherTypes';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface MultiPartitionQueueProps {
  currentIndex: number | null;
  disabled?: boolean;
  isBatchFlashing: boolean;
  onClearQueue: () => void;
  onExecuteBatch: () => void;
  onRemoveItem: (id: string) => void;
  queue: BatchPartitionItem[];
  serial: string | null;
}

export function MultiPartitionQueue({
  queue,
  isBatchFlashing,
  currentIndex,
  onRemoveItem,
  onClearQueue,
  onExecuteBatch,
  serial,
  disabled = false,
}: MultiPartitionQueueProps) {
  return (
    <Card className="flex flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <ListOrdered className="size-5 text-muted-foreground" />
            Deterministic Multi-Partition Queue
          </CardTitle>
          <CardDescription className="text-caption">
            Stage multiple images (e.g. boot, vendor_boot, dtbo, vbmeta) and flash sequentially in
            safe order.
          </CardDescription>
        </div>

        {queue.length > 0 ? (
          <Button
            aria-label="Clear batch queue"
            className="size-7 p-0"
            disabled={disabled || isBatchFlashing}
            onClick={onClearQueue}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
              data-icon="inline-start"
            />
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/80 border-dashed p-6 text-center">
            <HardDrive className="size-6 text-muted-foreground/40" />
            <p className="font-medium text-body text-muted-foreground">Queue is empty</p>
            <p className="text-caption text-muted-foreground/70">
              Select partition images in the flasher panel to queue batch operations.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto pr-1">
              {queue.map((item, idx) => (
                <div
                  className={cn(
                    'flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors',
                    item.status === 'flashing'
                      ? 'border-primary/50 bg-primary/5'
                      : item.status === 'success'
                        ? 'border-success/30 bg-success/5'
                        : item.status === 'failed'
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-border/70 bg-surface-raised/40',
                  )}
                  key={item.id}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="font-mono font-semibold text-[11px] text-muted-foreground">
                      #{idx + 1}
                    </span>

                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-body text-foreground">
                          {item.partition}
                        </span>
                        <span className="truncate font-mono text-caption text-muted-foreground">
                          ← {item.fileName}
                        </span>
                      </div>
                      {item.error ? (
                        <span className="truncate text-[10px] text-destructive">{item.error}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      className="font-mono text-[9px] uppercase"
                      variant={
                        item.status === 'success'
                          ? 'success'
                          : item.status === 'failed'
                            ? 'destructive'
                            : item.status === 'flashing'
                              ? 'default'
                              : 'outline'
                      }
                    >
                      {item.status === 'flashing' ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="size-2.5 animate-spin" />
                          Flashing
                        </span>
                      ) : (
                        item.status
                      )}
                    </Badge>

                    <Button
                      aria-label={`Remove ${item.partition} from queue`}
                      className="size-6 p-0"
                      disabled={disabled || isBatchFlashing}
                      onClick={() => onRemoveItem(item.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X className="size-3 text-muted-foreground" data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={disabled || isBatchFlashing || queue.length === 0 || !serial}
              onClick={onExecuteBatch}
              type="button"
            >
              {isBatchFlashing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" data-icon="inline-start" />
                  Flashing Batch ({currentIndex === null ? 1 : currentIndex + 1}/{queue.length})...
                </>
              ) : (
                <>
                  <Zap className="mr-2 size-4" data-icon="inline-start" />
                  Flash {queue.length} Partitions in Sequence
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
