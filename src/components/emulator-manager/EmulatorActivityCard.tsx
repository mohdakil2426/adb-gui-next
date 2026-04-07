import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { cn } from '@/lib/utils';
import { History } from 'lucide-react';

function levelClassName(level: 'info' | 'success' | 'warning' | 'error'): string {
  switch (level) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

export function EmulatorActivityCard() {
  const activity = useEmulatorManagerStore((state) => state.activity);
  const clearActivity = useEmulatorManagerStore((state) => state.clearActivity);

  return (
    <Card>
      <CardHeader className="gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              Emulator activity
            </CardTitle>
            <CardDescription>
              Page-scoped action history for launches, root steps, and restore operations.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={activity.length === 0}
            onClick={clearActivity}
          >
            Clear
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {activity.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Run an emulator action and the event trail will appear here."
            className="py-8"
          />
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {activity
                .slice()
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={cn('rounded-xl border p-3 text-sm', levelClassName(entry.level))}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium capitalize">{entry.level}</span>
                      <span className="text-xs opacity-80">{entry.timestamp}</span>
                    </div>
                    <p className="mt-2 break-words">{entry.message}</p>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
