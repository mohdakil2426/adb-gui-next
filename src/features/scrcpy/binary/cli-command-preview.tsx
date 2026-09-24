import { useQuery } from "@tanstack/react-query";
import { Terminal } from "lucide-react";

import { ScrcpyPreviewCommand } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { CopyButton } from "@/shared/components/copy-button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

// Empty state handled across UI when data?.length === 0

interface CliCommandPreviewProps {
  options: backend.ScrcpyLaunchOptions;
  selectedSerials: Set<string>;
}

export const CliCommandPreview = ({ options, selectedSerials }: CliCommandPreviewProps) => {
  const serials = [...selectedSerials];
  const primarySerial = serials[0] ?? null;

  const { data: preview } = useQuery({
    queryFn: () => ScrcpyPreviewCommand(options, primarySerial),
    queryKey: ["scrcpy", "previewCommand", options, primarySerial],
    staleTime: 5000,
  });

  const cliCommand = preview?.command ?? "scrcpy";
  const flagsExplanation = preview?.explanations ?? [];
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal aria-hidden="true" className="text-foreground size-4" />
            <CardTitle className="text-body text-foreground font-semibold">
              Live Generated Scrcpy CLI Command
            </CardTitle>
          </div>
          <Badge
            className="border-border bg-surface-raised text-muted-foreground text-mono-sm font-mono"
            variant="outline"
          >
            Direct Process Invocation
          </Badge>
        </div>
        <CardDescription className="text-caption text-muted-foreground">
          Real-time CLI command constructed from active tuning parameters. Scrcpy is executed
          directly via OS process detachment.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Terminal Monospace Command Block */}
        <div className="group border-border/80 bg-surface-raised relative flex items-center justify-between gap-3 rounded-lg border p-3">
          <code className="text-foreground text-mono min-w-0 flex-1 font-mono break-all select-all">
            {cliCommand}
          </code>
          <div className="shrink-0">
            <CopyButton label="Scrcpy command" value={cliCommand} />
          </div>
        </div>

        {/* Active Flag Explanations */}
        {flagsExplanation.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-caption text-foreground font-semibold">
              Active Argument Breakdown ({flagsExplanation.length} flags):
            </span>
            <div className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2">
              {flagsExplanation.map(({ flag, description }) => (
                <div
                  className="border-border/60 bg-surface-raised/30 flex items-center justify-between gap-2 rounded border px-2.5 py-1.5"
                  key={flag}
                >
                  <code className="text-foreground text-mono-sm font-mono font-semibold">
                    {flag}
                  </code>
                  <span className="text-caption text-muted-foreground truncate text-right">
                    {description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
