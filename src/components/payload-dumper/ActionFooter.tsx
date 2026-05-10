import { Download, RefreshCw, Loader2, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytesNum } from '@/lib/utils';

interface ActionFooterProps {
  payloadPath: string;
  status: string;
  toExtractCount: number;
  toExtractSize: number;
  selectedCount: number;
  hasCompletedPartitions: boolean;
  onReset: () => void;
  onExtract: () => void;
  onCancel?: () => void;
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
    if (status === 'extracting') return 'Extracting...';
    if (toExtractCount > 0) {
      return `Extract (${toExtractCount}) \u2014 ${formatBytesNum(toExtractSize)}`;
    }
    if (selectedCount > 0 && hasCompletedPartitions) return 'Already Extracted';
    return 'Select Partitions';
  };

  return (
    <div className="border-t pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onReset}
          disabled={status === 'extracting' || status === 'cancelling'}
          className="h-11 w-full"
        >
          <RefreshCw className="mr-2 size-4" />
          Reset
        </Button>
        {status === 'extracting' && onCancel ? (
          <Button variant="destructive" size="lg" onClick={onCancel} className="h-11 w-full">
            <StopCircle className="mr-2 size-4" />
            Cancel
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onExtract}
            disabled={
              !payloadPath ||
              status === 'extracting' ||
              status === 'cancelling' ||
              status === 'loading-partitions' ||
              toExtractCount === 0
            }
            className="h-11 w-full"
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
