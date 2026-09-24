import { Loader2 } from "lucide-react";

import { Skeleton } from "@/shared/ui/skeleton";
import { getFileName } from "@/shared/utils/file-path";

interface LoadingStateProps {
  mode: "local" | "remote";
  payloadPath: string;
  remoteUrl: string;
}

/**
 * Local payload parse. Indeterminate — the manifest is read in one pass and
 * there is no byte count to report — so it says what it is doing and reserves
 * the shape of the partition table rather than pretending to a percentage.
 */
const getLoadingMessage = (mode: "local" | "remote", path: string): string => {
  if (mode === "remote") {
    return "Connecting to remote URL…";
  }
  if (path.toLowerCase().endsWith(".zip")) {
    return "Extracting payload from ZIP…";
  }
  return "Parsing partition manifest…";
};

export const LoadingState = ({ mode, remoteUrl, payloadPath }: LoadingStateProps) => {
  const message = getLoadingMessage(mode, payloadPath);
  const subtitle = mode === "remote" ? remoteUrl : getFileName(payloadPath);

  return (
    <output aria-busy="true" className="flex w-full flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Loader2 aria-hidden="true" className="text-primary size-4 shrink-0 animate-spin" />
        <span className="text-body font-medium">{message}</span>
      </div>
      <p className="text-mono text-muted-foreground min-w-0 truncate font-mono" title={subtitle}>
        {subtitle}
      </p>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </output>
  );
};
