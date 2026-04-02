import { Download, RefreshCw, Loader2 } from 'lucide-react';
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
    <div className="flex items-center justify-between border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={status === 'extracting'}
        className="text-muted-foreground"
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Reset
      </Button>
      <Button
        onClick={onExtract}
        disabled={
          !payloadPath ||
          status === 'extracting' ||
          status === 'loading-partitions' ||
          toExtractCount === 0
        }
      >
        {status === 'extracting' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {getExtractLabel()}
          </>
        )}
      </Button>
    </div>
  );
}
