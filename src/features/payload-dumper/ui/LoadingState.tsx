import { Loader2 } from 'lucide-react';
import { getFileName } from '@/lib/utils';

interface LoadingStateProps {
  mode: 'local' | 'remote';
  payloadPath: string;
  remoteUrl: string;
}

/**
 * Loading stage indicator shown while partitions are being loaded.
 * Displays contextual messages based on source type (remote URL, ZIP, or plain .bin).
 */
export function LoadingState({ mode, remoteUrl, payloadPath }: LoadingStateProps) {
  const getMessage = (): string => {
    if (mode === 'remote') {
      return 'Connecting to remote URL...';
    }
    if (payloadPath.toLowerCase().endsWith('.zip')) {
      return 'Extracting payload from ZIP...';
    }
    return 'Parsing partition manifest...';
  };

  const getSubtitle = (): string => {
    if (mode === 'remote') {
      return remoteUrl;
    }
    return getFileName(payloadPath);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
        <div className="relative rounded-full bg-primary/10 p-5">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="font-medium text-sm">{getMessage()}</p>
        <p className="max-w-xs truncate text-muted-foreground text-xs" title={getSubtitle()}>
          {getSubtitle()}
        </p>
      </div>
    </div>
  );
}
