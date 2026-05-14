import { Download, Loader2, RefreshCw, StopCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatBytesNum } from '@/shared/utils/formatting';

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
 * Action footer with Reset and Extract buttons.
 * Zone 3 of the loaded state layout.
 * Extract button shows dynamic labels based on state.
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
    if (status === 'extracting') {
      return 'Extracting...';
    }
    if (toExtractCount > 0) {
      return `Extract (${toExtractCount}) \u2014 ${formatBytesNum(toExtractSize)}`;
    }
    if (selectedCount > 0 && hasCompletedPartitions) {
      return 'Already Extracted';
    }
    return 'Select Partitions';
  };

  return (
    <div className="border-t pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          className="h-11 w-full"
          disabled={status === 'extracting' || status === 'cancelling'}
          onClick={onReset}
          size="lg"
          variant="outline"
        >
          <RefreshCw className="mr-2 size-4" />
          Reset
        </Button>
        {status === 'extracting' && onCancel ? (
          <Button className="h-11 w-full" onClick={onCancel} size="lg" variant="destructive">
            <StopCircle className="mr-2 size-4" />
            Cancel
          </Button>
        ) : (
          <Button
            className="h-11 w-full"
            disabled={
              !payloadPath ||
              status === 'extracting' ||
              status === 'cancelling' ||
              status === 'loading-partitions' ||
              toExtractCount === 0
            }
            onClick={onExtract}
            size="lg"
          >
            {status === 'extracting' || status === 'cancelling' ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {status === 'cancelling' ? 'Cancelling...' : 'Extracting...'}
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                {getExtractLabel()}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
