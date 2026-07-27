import { m } from 'framer-motion';
import { ChevronDown, FileArchive, Globe } from 'lucide-react';
import { memo } from 'react';
import type { backend } from '@/desktop/models';
import { FileBannerDetails } from '@/features/payload-dumper/ui/FileBannerDetails';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { getFileName } from '@/shared/utils/filePath';
import { formatBytes } from '@/shared/utils/format';

interface FileBannerProps {
  isDetailsOpen: boolean;
  isRemote: boolean;
  onRefreshPartitions: () => void;
  onSelectPayload: () => void;
  onToggleDetails: () => void;
  outputPath: string;
  partitionCount: number;
  payloadPath: string;
  prefetch: boolean;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  status: string;
  totalPayloadSize: number;
}

/**
 * What is loaded, and where it came from.
 *
 * The banner used to carry four identical 28px ghost icon buttons — the
 * smallest controls in the app — one of which was the required output
 * directory. Output moved out to its own labelled field; what remains are the
 * two actions that operate on the payload itself, on the 32px toolbar scale.
 */
export const FileBanner = memo(function FileBanner({
  isDetailsOpen,
  isRemote,
  onRefreshPartitions,
  onSelectPayload,
  onToggleDetails,
  outputPath,
  partitionCount,
  payloadPath,
  prefetch,
  remoteMetadata,
  remoteUrl,
  status,
  totalPayloadSize,
}: FileBannerProps) {
  const displayName = isRemote ? remoteUrl : getFileName(payloadPath);
  const sourceValue = isRemote ? remoteUrl : payloadPath;
  const isDisabled = status === 'extracting' || status === 'loading-partitions';

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
          {isRemote ? (
            <Globe aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <FileArchive aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="min-w-0 max-w-full truncate font-medium text-body" title={displayName}>
              {displayName}
            </p>
            <p className="min-w-0 select-all break-all font-mono text-mono text-muted-foreground">
              {sourceValue}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label="Change payload file"
            disabled={isDisabled}
            onClick={onSelectPayload}
            size="sm"
            type="button"
            variant="outline"
          >
            <FileArchive aria-hidden="true" />
            Change
          </Button>
          {partitionCount > 0 ? (
            <RefreshButton
              aria-label="Refresh partitions"
              isLoading={status === 'loading-partitions'}
              mode="icon"
              onClick={onRefreshPartitions}
              tooltip="Refresh partitions"
            />
          ) : null}
        </div>
      </div>

      {partitionCount > 0 ? (
        <p className="numeric text-caption text-muted-foreground">
          {partitionCount} partitions · {formatBytes(totalPayloadSize)} total
        </p>
      ) : null}

      {/* Collapsible details toggle — only for remote payloads with metadata */}
      {isRemote && remoteMetadata ? (
        <>
          <button
            aria-expanded={isDetailsOpen}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md py-1 text-caption text-muted-foreground transition-colors duration-90 ease-standard hover:bg-accent hover:text-foreground"
            onClick={onToggleDetails}
            type="button"
          >
            <m.span animate={{ rotate: isDetailsOpen ? 180 : 0 }} transition={{ duration: 0.14 }}>
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </m.span>
            {isDetailsOpen ? 'Hide details' : 'Show details'}
          </button>

          {/* Grid 0fr→1fr expand: avoids animating height (layout thrash / react-doctor). */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-standard',
              isDetailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div
              className="min-h-0 overflow-hidden"
              // Keep collapsed content out of the tab order / a11y tree.
              inert={!isDetailsOpen}
            >
              <div
                className={cn(
                  'transition-opacity duration-200 ease-standard',
                  isDetailsOpen ? 'opacity-100' : 'opacity-0',
                )}
              >
                <FileBannerDetails
                  metadata={remoteMetadata}
                  outputPath={outputPath}
                  prefetch={prefetch}
                  remoteUrl={remoteUrl}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
});
