import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  FolderOpen,
  HardDrive,
  TriangleAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatDuration } from '@/shared/utils/format';

interface ExtractionStatusCardProps {
  errorMessage: string;
  extractedFiles: string[];
  extractionStats?: backend.ExtractionStats | null;
  onOpenOutputFolder: () => void;
  onRetry: () => void;
  outputDir: string;
  status: 'success' | 'error';
}

const MS_PER_SECOND = 1000;

type Tone = 'success' | 'warning' | 'danger';

const TONE_SURFACE: Record<Tone, string> = {
  danger: 'border-destructive/40 bg-destructive-muted',
  success: 'border-success/40 bg-success-muted',
  warning: 'border-warning/40 bg-warning-muted',
};

const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
};

/**
 * Terminal state of an extraction.
 *
 * The view used to gate this card on `extractedFiles.length > 0`, so a failure
 * that died before the first write rendered **nothing at all** — only a toast
 * that vanished — and the "no files" branch below was unreachable. The card is
 * now shown for every terminal status and covers all three outcomes: wrote
 * files, wrote none and failed, wrote none and reported success.
 */
export function ExtractionStatusCard({
  status,
  extractedFiles,
  outputDir,
  errorMessage,
  extractionStats,
  onOpenOutputFolder,
  onRetry,
}: ExtractionStatusCardProps) {
  const isSuccess = status === 'success';
  const wroteNothing = extractedFiles.length === 0;
  const tone: Tone = isSuccess ? (wroteNothing ? 'warning' : 'success') : 'danger';

  const title = isSuccess
    ? wroteNothing
      ? 'Finished without writing anything'
      : 'Extraction complete'
    : 'Extraction failed';

  return (
    <section
      aria-live="polite"
      className={cn('flex min-w-0 flex-col gap-3 rounded-lg border p-4', TONE_SURFACE[tone])}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className={cn('flex shrink-0 items-center gap-1.5 text-title', TONE_TEXT[tone])}>
          {isSuccess ? (
            wroteNothing ? (
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            )
          ) : (
            <XCircle aria-hidden="true" className="size-4 shrink-0" />
          )}
          {title}
        </h2>

        {extractionStats != null && isSuccess && !wroteNothing ? (
          <div className="numeric flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
            <HardDrive aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">
              {extractionStats.partitionsExtracted} partitions
              {extractionStats.totalBytes > 0 ? (
                <>
                  <span className="mx-1 text-foreground-subtle">·</span>
                  {formatBytes(extractionStats.totalBytes)}
                </>
              ) : null}
              {extractionStats.durationMs > 0 ? (
                <>
                  <span className="mx-1 text-foreground-subtle">·</span>
                  <Clock aria-hidden="true" className="inline size-3 align-text-bottom" />{' '}
                  {formatDuration(extractionStats.durationMs / MS_PER_SECOND)}
                </>
              ) : null}
              {extractionStats.throughputMbps > 0 ? (
                <>
                  <span className="mx-1 text-foreground-subtle">·</span>
                  <Zap aria-hidden="true" className="inline size-3 align-text-bottom" />{' '}
                  {extractionStats.throughputMbps.toFixed(0)} MB/s
                </>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      {/* Failure: the message, then what to do about it. */}
      {isSuccess ? null : (
        <div className="flex flex-col gap-2">
          {errorMessage ? (
            <p className="min-w-0 break-words font-mono text-destructive text-mono">
              {errorMessage}
            </p>
          ) : null}
          <p className="text-body text-muted-foreground">
            {wroteNothing
              ? 'No images were written, so nothing on disk changed. Check the output directory is writable and the payload is complete, then extract again.'
              : 'Partitions written before the failure are still on disk. Re-run to retry only what is left.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              Try again
            </Button>
            {outputDir ? (
              <Button onClick={onOpenOutputFolder} size="sm" type="button" variant="ghost">
                <FolderOpen aria-hidden="true" />
                Open output folder
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Success with nothing written — a real outcome, not a blank card. */}
      {isSuccess && wroteNothing ? (
        <p className="text-body text-muted-foreground">
          The extraction reported success but produced no images. Every selected partition may
          already have been written — select a different partition and try again.
        </p>
      ) : null}

      {/* Output path */}
      {isSuccess && !wroteNothing && outputDir ? (
        <div className="flex min-w-0 items-center gap-2">
          <FolderOpen aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <code
            className="min-w-0 flex-1 select-all truncate font-mono text-mono text-muted-foreground"
            title={outputDir}
          >
            {outputDir}
          </code>
          <Button
            aria-label="Open output folder"
            onClick={onOpenOutputFolder}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* Extracted files */}
      {extractedFiles.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {extractedFiles.map((file) => (
            <li
              className="inline-flex min-w-0 items-center gap-1 font-mono text-mono text-muted-foreground"
              key={file}
              title={file}
            >
              <FileDown aria-hidden="true" className="size-3 shrink-0 text-success" />
              <span className="max-w-48 truncate">{file}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
