import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { backend } from '@/lib/desktop/models';
import { cn } from '@/lib/utils';
import { MonitorSmartphone } from 'lucide-react';

interface AvdRosterProps {
  avds: backend.AvdSummary[];
  isLoading: boolean;
  selectedAvdName: string | null;
  onSelect: (name: string) => void;
}

function rootStateLabel(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'Rooted';
    case 'modified':
      return 'Modified';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Stock';
  }
}

function rootStateClassName(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'modified':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'unknown':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    default:
      return 'border-border bg-background text-muted-foreground';
  }
}

export function AvdRoster({ avds, isLoading, selectedAvdName, onSelect }: AvdRosterProps) {
  return (
    <Card className="min-h-[34rem] overflow-hidden">
      <CardHeader className="gap-3 border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MonitorSmartphone className="size-5" />
          Emulator Roster
        </CardTitle>
        <CardDescription>
          Existing Android Studio AVDs discovered from your local SDK and AVD home.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <EmptyState
            icon={MonitorSmartphone}
            title="Scanning AVDs"
            description="Looking for installed Android Studio emulator profiles."
            className="px-6 py-12"
          />
        ) : avds.length === 0 ? (
          <EmptyState
            icon={MonitorSmartphone}
            title="No AVDs found"
            description="Create an Android Studio virtual device first, then refresh this page."
            className="px-6 py-12"
          />
        ) : (
          <ScrollArea className="h-[34rem]">
            <div className="flex flex-col p-3">
              {avds.map((avd) => {
                const isSelected = avd.name === selectedAvdName;

                return (
                  <button
                    key={avd.name}
                    type="button"
                    onClick={() => onSelect(avd.name)}
                    className={cn(
                      'flex w-full flex-col gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/10 shadow-sm'
                        : 'border-transparent hover:border-border hover:bg-accent/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{avd.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          API {avd.apiLevel ?? 'Unknown'}
                          {avd.abi ? ` • ${avd.abi}` : ''}
                        </p>
                      </div>
                      {avd.isRunning ? (
                        <Badge className="shrink-0 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Running
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 rounded-full">
                          Stopped
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'rounded-full px-2 py-0 text-[10px]',
                          rootStateClassName(avd.rootState),
                        )}
                      >
                        {rootStateLabel(avd.rootState)}
                      </Badge>
                      {avd.hasBackups && (
                        <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                          Backups ready
                        </Badge>
                      )}
                      {avd.warnings.length > 0 && (
                        <Badge className="rounded-full bg-amber-500/15 px-2 py-0 text-[10px] text-amber-700 dark:text-amber-300">
                          {avd.warnings.length} warning{avd.warnings.length === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>

                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {avd.target ?? 'Unknown target'}
                      {avd.deviceName ? ` • ${avd.deviceName}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
