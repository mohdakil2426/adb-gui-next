import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  FolderOpen,
  HardDrive,
  XCircle,
  Zap,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

interface ExtractionStatusCardProps {
  errorMessage: string;
  extractedFiles: string[];
  extractionStats?: backend.ExtractionStats | null;
  onOpenOutputFolder: () => void;
  outputDir: string;
  status: 'success' | 'error';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Compact post-extraction status card.
 * Shows success/error header, inline stats, output path, and extracted files
 * in a tight, borderless layout.
 */
export function ExtractionStatusCard({
  status,
  extractedFiles,
  outputDir,
  errorMessage,
  extractionStats,
  onOpenOutputFolder,
}: ExtractionStatusCardProps) {
  if (extractedFiles.length === 0 && status !== 'success') {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">
            No files extracted yet. Select partitions and click Extract.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isSuccess = status === 'success';

  return (
    <Card
      className={cn(
        'min-w-0 border',
        isSuccess ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row: status badge + inline stats */}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div
            className={cn(
              'flex shrink-0 items-center gap-1.5',
              isSuccess ? 'text-success' : 'text-destructive',
            )}
          >
            {isSuccess ? (
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <XCircle aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span className="font-semibold text-sm">
              {isSuccess ? 'Extraction Complete' : 'Extraction Failed'}
            </span>
          </div>

          {extractionStats != null && isSuccess ? (
            <div className="flex items-center gap-2 truncate text-muted-foreground text-xs">
              <HardDrive aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">
                {extractionStats.partitionsExtracted} partitions
                <span className="mx-1 text-muted-foreground/50">·</span>
                {formatBytes(extractionStats.totalBytes)}
                <span className="mx-1 text-muted-foreground/50">·</span>
                <Clock aria-hidden="true" className="inline size-3 align-text-bottom" />
                {formatDuration(extractionStats.durationMs)}
                <span className="mx-1 text-muted-foreground/50">·</span>
                <Zap aria-hidden="true" className="inline size-3 align-text-bottom" />
                {extractionStats.throughputMbps.toFixed(0)} MB/s
              </span>
            </div>
          ) : null}
        </div>

        {/* Error message */}
        {!isSuccess && errorMessage ? (
          <p className="text-destructive text-sm">{errorMessage}</p>
        ) : null}

        {/* Output path */}
        {isSuccess && outputDir ? (
          <div className="flex min-w-0 items-center gap-2">
            <FolderOpen aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <code
              className="flex-1 select-all truncate font-mono text-muted-foreground text-xs"
              title={outputDir}
            >
              {outputDir}
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Open output folder"
                  className="size-6 shrink-0"
                  onClick={onOpenOutputFolder}
                  size="icon"
                  variant="ghost"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open output folder</TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        {/* Extracted files */}
        {isSuccess && extractedFiles.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {extractedFiles.map((file) => (
              <span
                className="inline-flex items-center gap-1 text-muted-foreground text-xs"
                key={file}
                title={file}
              >
                <FileDown aria-hidden="true" className="size-3 shrink-0 text-success" />
                <span className="max-w-[12rem] truncate">{file}</span>
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
