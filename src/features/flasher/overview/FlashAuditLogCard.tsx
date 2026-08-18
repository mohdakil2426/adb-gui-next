import { AlertTriangle, CheckCircle2, Clock, FileText, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { CopyButton } from '@/shared/components/CopyButton';
import { useLogStore } from '@/shared/stores/logStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

export function FlashAuditLogCard() {
  const logs = useLogStore((state) => state.logs);
  const clearLogs = useLogStore((state) => state.clearLogs);

  const flasherLogs = useMemo(
    () =>
      logs
        .filter((log) => {
          const text = log.message.toLowerCase();
          return (
            text.includes('flash') ||
            text.includes('sideload') ||
            text.includes('fastboot') ||
            text.includes('slot') ||
            text.includes('wipe') ||
            text.includes('erase') ||
            text.includes('partition')
          );
        })
        .slice(-20)
        .reverse(),
    [logs],
  );

  const exportText = useMemo(
    () =>
      flasherLogs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n'),
    [flasherLogs],
  );

  return (
    <Card className="flex h-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Clock className="size-5 text-muted-foreground" />
            Recent Flash History & Audit Log
          </CardTitle>
          <CardDescription className="text-caption">
            Session history of partition flash, slot switch, and sideload operations.
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5">
          {exportText ? <CopyButton value={exportText} /> : null}
          <Button
            aria-label="Clear session flash log"
            className="size-7 p-0"
            disabled={flasherLogs.length === 0}
            onClick={clearLogs}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {flasherLogs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border/80 border-dashed p-8 text-center">
            <FileText className="size-8 text-muted-foreground/40" />
            <p className="font-medium text-body text-muted-foreground">
              No flash operations this session
            </p>
            <p className="text-caption text-muted-foreground/70">
              When you flash partitions, switch slots, or sideload packages, they will be logged
              here.
            </p>
          </div>
        ) : (
          <div className="flex max-h-[280px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {flasherLogs.map((entry) => (
              <div
                className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5 transition-colors hover:bg-surface-raised"
                key={entry.id}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                      entry.type === 'success' && 'bg-success/10 text-success',
                      entry.type === 'error' && 'bg-destructive/10 text-destructive',
                      entry.type === 'warning' && 'bg-warning/10 text-warning',
                      entry.type === 'info' && 'bg-info/10 text-info',
                    )}
                  >
                    {entry.type === 'success' ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate font-mono text-body text-foreground">{entry.message}</p>
                    <span className="font-mono text-[10px] text-caption text-muted-foreground">
                      {entry.timestamp}
                    </span>
                  </div>
                </div>

                <Badge
                  className="font-mono text-[9px] uppercase"
                  variant={
                    entry.type === 'success'
                      ? 'success'
                      : entry.type === 'error'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {entry.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
