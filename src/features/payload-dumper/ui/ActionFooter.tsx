import { Download, Loader2, RefreshCw, StopCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatBytes } from '@/shared/utils/format';

interface ActionFooterProps {
  hasCompletedPartitions: boolean;
  onCancel?: () => void;
  onExtract: () => void;
  onReset: () => void;
  payloadPath: string;
  selectedCount: number;
  status: string;
  toExtractCount: number;
  toExtractSize: number;
}

/**
 * Reset and Extract. The extract label states exactly what pressing it will do
 * — count and total bytes — so the destination of a multi-gigabyte write is
 * never a surprise.
 */
export function ActionFooter({
  payloadPath,
  status,
  toExtractCount,
  toExtractSize,
  selectedCount,
  hasCompletedPartitions,
  onReset,
  onExtract,
  onCancel,
}: ActionFooterProps) {
  const getExtractLabel = (): string => {
    if (toExtractCount > 0) {
      return `Extract ${toExtractCount} · ${formatBytes(toExtractSize)}`;
    }
    if (selectedCount > 0 && hasCompletedPartitions) {
      return 'Already extracted';
    }
    return 'Select partitions';
  };

  const isBusy = status === 'extracting' || status === 'cancelling';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-border border-t pt-3">
      <Button
        // Allow Reset during cancel so a hung backend cannot trap the UI forever.
        disabled={status === 'extracting'}
        onClick={onReset}
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" />
        Reset
      </Button>
      {status === 'extracting' && onCancel ? (
        <Button onClick={onCancel} type="button" variant="destructive">
          <StopCircle aria-hidden="true" />
          Cancel
        </Button>
      ) : status === 'cancelling' && onCancel ? (
        <Button disabled type="button" variant="destructive">
          <Loader2 aria-hidden="true" className="animate-spin" />
          Cancelling…
        </Button>
      ) : (
        <Button
          disabled={
            !payloadPath || isBusy || status === 'loading-partitions' || toExtractCount === 0
          }
          onClick={onExtract}
          type="button"
        >
          {isBusy ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Extracting…
            </>
          ) : (
            <>
              <Download aria-hidden="true" />
              {getExtractLabel()}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
