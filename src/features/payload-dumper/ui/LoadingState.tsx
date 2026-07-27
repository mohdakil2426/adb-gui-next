import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { getFileName } from '@/shared/utils/filePath';

interface LoadingStateProps {
  mode: 'local' | 'remote';
  payloadPath: string;
  remoteUrl: string;
}

/**
 * Local payload parse. Indeterminate — the manifest is read in one pass and
 * there is no byte count to report — so it says what it is doing and reserves
 * the shape of the partition table rather than pretending to a percentage.
 */
export function LoadingState({ mode, remoteUrl, payloadPath }: LoadingStateProps) {
  const message =
    mode === 'remote'
      ? 'Connecting to remote URL…'
      : payloadPath.toLowerCase().endsWith('.zip')
        ? 'Extracting payload from ZIP…'
        : 'Parsing partition manifest…';
  const subtitle = mode === 'remote' ? remoteUrl : getFileName(payloadPath);

  return (
    <output aria-busy="true" className="flex w-full flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary" />
        <span className="font-medium text-body">{message}</span>
      </div>
      <p className="min-w-0 truncate font-mono text-mono text-muted-foreground" title={subtitle}>
        {subtitle}
      </p>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </output>
  );
}
