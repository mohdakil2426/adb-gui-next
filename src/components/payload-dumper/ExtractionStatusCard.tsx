import {
  CheckCircle2,
  XCircle,
  FileDown,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';

interface ExtractionStatusCardProps {
  status: 'success' | 'error';
  extractedFiles: string[];
  outputDir: string;
  errorMessage: string;
  extractionStats?: backend.ExtractionStats | null;
  onOpenOutputFolder: () => void;
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
  if (ms >= 60000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
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
          <p className="text-sm text-muted-foreground">
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
        'border min-w-0',
        isSuccess ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Header row: status badge + inline stats */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center gap-1.5 shrink-0',
              isSuccess ? 'text-success' : 'text-destructive',
            )}
          >
            {isSuccess ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm font-semibold">
              {isSuccess ? 'Extraction Complete' : 'Extraction Failed'}
            </span>
          </div>

          {extractionStats != null && isSuccess ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <HardDrive className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {extractionStats.partitionsExtracted} partitions
                <span className="mx-1 text-muted-foreground/50">·</span>
                {formatBytes(extractionStats.totalBytes)}
                <span className="mx-1 text-muted-foreground/50">·</span>
                <Clock className="inline size-3 align-text-bottom" aria-hidden="true" />
                {formatDuration(extractionStats.durationMs)}
                <span className="mx-1 text-muted-foreground/50">·</span>
                <Zap className="inline size-3 align-text-bottom" aria-hidden="true" />
                {extractionStats.throughputMbps.toFixed(0)} MB/s
              </span>
            </div>
          ) : null}
        </div>

        {/* Error message */}
        {!isSuccess && errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}

        {/* Output path */}
        {isSuccess && outputDir ? (
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <code
              className="text-xs text-muted-foreground font-mono truncate flex-1 select-all"
              title={outputDir}
            >
              {outputDir}
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenOutputFolder}
                  className="size-6 shrink-0"
                  aria-label="Open output folder"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
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
                key={file}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title={file}
              >
                <FileDown className="size-3 text-success shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[12rem]">{file}</span>
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
