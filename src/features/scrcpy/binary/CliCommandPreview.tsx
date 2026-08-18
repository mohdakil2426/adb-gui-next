import { useQuery } from '@tanstack/react-query';
import { Terminal } from 'lucide-react';
import { ScrcpyPreviewCommand } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { CopyButton } from '@/shared/components/CopyButton';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

interface CliCommandPreviewProps {
  options: backend.ScrcpyLaunchOptions;
  selectedSerials: Set<string>;
}

export function CliCommandPreview({ options, selectedSerials }: CliCommandPreviewProps) {
  const serials = Array.from(selectedSerials);
  const primarySerial = serials[0] ?? null;

  const { data: preview } = useQuery({
    queryKey: ['scrcpy', 'previewCommand', options, primarySerial],
    queryFn: () => ScrcpyPreviewCommand(options, primarySerial),
    staleTime: 5000,
  });

  const cliCommand = preview?.command ?? 'scrcpy';
  const flagsExplanation = preview?.explanations ?? [];
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal aria-hidden="true" className="size-4 text-foreground" />
            <CardTitle className="font-semibold text-body text-foreground">
              Live Generated Scrcpy CLI Command
            </CardTitle>
          </div>
          <Badge
            className="border-border bg-surface-raised font-mono text-[10px] text-muted-foreground"
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
        <div className="group relative flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised p-3">
          <code className="min-w-0 flex-1 select-all break-all font-mono text-foreground text-mono">
            {cliCommand}
          </code>
          <div className="shrink-0">
            <CopyButton label="Scrcpy command" value={cliCommand} />
          </div>
        </div>

        {/* Active Flag Explanations */}
        {flagsExplanation.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-caption text-foreground">
              Active Argument Breakdown ({flagsExplanation.length} flags):
            </span>
            <div className="grid @lg:grid-cols-2 grid-cols-1 gap-1.5">
              {flagsExplanation.map(({ flag, description }) => (
                <div
                  className="flex items-center justify-between gap-2 rounded border border-border/60 bg-surface-raised/30 px-2.5 py-1.5"
                  key={flag}
                >
                  <code className="font-mono font-semibold text-foreground text-mono-sm">
                    {flag}
                  </code>
                  <span className="truncate text-right text-caption text-muted-foreground">
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
}
