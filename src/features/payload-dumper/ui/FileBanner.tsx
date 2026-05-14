import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ExternalLink,
  FileArchive,
  FolderOutput,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { memo } from 'react';
import type { backend } from '@/desktop/models';
import { FileBannerDetails } from '@/features/payload-dumper/ui/FileBannerDetails';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { formatBytesNum, getFileName } from '@/shared/utils/formatting';

interface FileBannerProps {
  effectiveOutputPath: string;
  isDetailsOpen: boolean;
  isRemote: boolean;
  onOpenOutputFolder: () => void;
  onRefreshPartitions: () => void;
  onSelectOutput: () => void;
  onSelectPayload: () => void;
  onToggleDetails: () => void;
  outputDir: string;
  outputPath: string;
  partitions: { name: string; size: number }[];
  payloadPath: string;
  prefetch: boolean;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  status: string;
  totalPayloadSize: number;
}

/**
 * File info banner showing payload details, partition count, and action buttons.
 * Zone 1 of the loaded state layout.
 */
export const FileBanner = memo(function FileBanner({
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
  remoteMetadata,
  isDetailsOpen,
  onToggleDetails,
  prefetch,
}: FileBannerProps) {
  const displayName = isRemote ? remoteUrl : getFileName(payloadPath);
  const sourceValue = isRemote ? remoteUrl : payloadPath;
  const isDisabled = status === 'extracting' || status === 'loading-partitions';

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border bg-muted/30 p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {isRemote ? (
            <Globe className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <FileArchive className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="min-w-0 max-w-full truncate font-medium text-sm" title={displayName}>
              {displayName}
            </p>
            <p className="mt-1 whitespace-normal break-all text-muted-foreground text-xs">
              <span className="font-medium">Source</span>{' '}
              <span className="select-all font-mono text-foreground/90">{sourceValue}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-7 w-7"
                disabled={isDisabled}
                onClick={onSelectPayload}
                size="icon"
                variant="ghost"
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
                  className="h-7 w-7"
                  disabled={status === 'loading-partitions' || status === 'extracting'}
                  onClick={onRefreshPartitions}
                  size="icon"
                  variant="ghost"
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
                className="h-7 w-7"
                disabled={status === 'extracting'}
                onClick={onSelectOutput}
                size="icon"
                variant="ghost"
              >
                <FolderOutput className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {effectiveOutputPath || 'Select Output Directory'}
            </TooltipContent>
          </Tooltip>
          {effectiveOutputPath ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-7 w-7"
                  onClick={onOpenOutputFolder}
                  size="icon"
                  variant="ghost"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open Output Folder</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        {partitions.length > 0 && (
          <span>
            {partitions.length} partitions &bull; {formatBytesNum(totalPayloadSize)} total
          </span>
        )}
        {effectiveOutputPath ? (
          <>
            <span>&bull;</span>
            <div className="min-w-0 flex-1">
              <p
                className={cn('truncate', outputDir && !outputPath && 'text-success')}
                title={effectiveOutputPath}
              >
                {getFileName(effectiveOutputPath)}
                {outputDir && !outputPath ? ' (auto)' : null}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Collapsible details toggle — only for remote payloads with metadata */}
      {isRemote && remoteMetadata ? (
        <>
          <button
            className={cn(
              'flex w-full items-center justify-center gap-1.5 py-1',
              'text-muted-foreground text-xs transition-colors hover:text-foreground',
              'cursor-pointer rounded-md hover:bg-muted/50',
            )}
            onClick={onToggleDetails}
          >
            <motion.span
              animate={{ rotate: isDetailsOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="size-3.5" />
            </motion.span>
            {isDetailsOpen ? 'Hide Details' : 'Show Details'}
          </button>

          <AnimatePresence initial={false}>
            {isDetailsOpen ? (
              <motion.div
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <FileBannerDetails
                  metadata={remoteMetadata}
                  outputPath={effectiveOutputPath}
                  prefetch={prefetch}
                  remoteUrl={remoteUrl}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );
});
