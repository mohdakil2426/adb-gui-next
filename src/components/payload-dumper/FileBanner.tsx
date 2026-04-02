import { FileArchive, FolderOutput, ExternalLink, RefreshCw, Globe } from 'lucide-react';
import { cn, getFileName, formatBytesNum } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FileBannerProps {
  payloadPath: string;
  isRemote: boolean;
  remoteUrl: string;
  partitions: Array<{ name: string; size: number }>;
  totalPayloadSize: number;
  effectiveOutputPath: string;
  outputDir: string;
  outputPath: string;
  status: string;
  onSelectPayload: () => void;
  onRefreshPartitions: () => void;
  onSelectOutput: () => void;
  onOpenOutputFolder: () => void;
}

/**
 * File info banner showing payload details, partition count, and action buttons.
 * Zone 1 of the loaded state layout.
 */
export function FileBanner({
  payloadPath,
  isRemote,
  remoteUrl,
  partitions,
  totalPayloadSize,
  effectiveOutputPath,
  outputDir,
  outputPath,
  status,
  onSelectPayload,
  onRefreshPartitions,
  onSelectOutput,
  onOpenOutputFolder,
}: FileBannerProps) {
  const displayName = isRemote ? remoteUrl : getFileName(payloadPath);
  const isDisabled = status === 'extracting' || status === 'loading-partitions';

  return (
    <div className="rounded-lg bg-muted/30 border p-3 flex flex-col gap-2 w-full overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
          {isRemote ? (
            <Globe className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <FileArchive className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={displayName}>
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSelectPayload}
                disabled={isDisabled}
              >
                <FileArchive className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Change Payload</TooltipContent>
          </Tooltip>
          {partitions.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRefreshPartitions}
                  disabled={status === 'loading-partitions' || status === 'extracting'}
                >
                  <RefreshCw
                    className={cn('h-3.5 w-3.5', status === 'loading-partitions' && 'animate-spin')}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh Partitions</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSelectOutput}
                disabled={status === 'extracting'}
              >
                <FolderOutput className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {effectiveOutputPath || 'Select Output Directory'}
            </TooltipContent>
          </Tooltip>
          {effectiveOutputPath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onOpenOutputFolder}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open Output Folder</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        {partitions.length > 0 && (
          <span>
            {partitions.length} partitions &bull; {formatBytesNum(totalPayloadSize)} total
          </span>
        )}
        {effectiveOutputPath && (
          <>
            <span>&bull;</span>
            <div className="flex-1 min-w-0">
              <p
                className={cn('truncate', outputDir && !outputPath && 'text-success')}
                title={effectiveOutputPath}
              >
                {getFileName(effectiveOutputPath)}
                {outputDir && !outputPath && ' (auto)'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
