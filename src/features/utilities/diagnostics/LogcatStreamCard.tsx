import { Download, RefreshCw, Search, Terminal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { GetLogcatSnapshot, SaveLog } from '@/desktop/backend';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/utils/cn';

interface LogcatStreamCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
}

type LogLevel = 'ALL' | 'V' | 'D' | 'I' | 'W' | 'E' | 'F';

interface LogEntry {
  id: string;
  level: LogLevel;
  line: number;
  message: string;
  raw: string;
  tag: string;
  timestamp: string;
}

export function LogcatStreamCard({ deviceMode, deviceSerial }: LogcatStreamCardProps) {
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const logScrollRef = useRef<HTMLDivElement>(null);

  const fetchLogcatSnapshot = useCallback(async () => {
    if (!deviceSerial) {
      return;
    }
    setIsFetchingLogs(true);
    try {
      const rawText = await GetLogcatSnapshot(deviceSerial, 500);
      const lines = rawText.split('\n');
      const parsed: LogEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) {
          continue;
        }

        let level: LogLevel = 'I';
        if (line.includes(' V ') || line.startsWith('V/')) {
          level = 'V';
        } else if (line.includes(' D ') || line.startsWith('D/')) {
          level = 'D';
        } else if (line.includes(' I ') || line.startsWith('I/')) {
          level = 'I';
        } else if (line.includes(' W ') || line.startsWith('W/')) {
          level = 'W';
        } else if (line.includes(' E ') || line.startsWith('E/')) {
          level = 'E';
        } else if (line.includes(' F ') || line.startsWith('F/')) {
          level = 'F';
        }

        parsed.push({
          id: `log-${i}-${Date.now()}`,
          level,
          line: i + 1,
          message: line,
          raw: line,
          tag: 'Android',
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      setLogs(parsed);
    } catch {
      // Ignore poll error
    } finally {
      setIsFetchingLogs(false);
    }
  }, [deviceSerial]);

  useEffect(() => {
    if (isAdb) {
      void fetchLogcatSnapshot();
    }
  }, [isAdb, fetchLogcatSnapshot]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((entry) => {
        const matchesLevel = selectedLevel === 'ALL' || entry.level === selectedLevel;
        const matchesSearch =
          !searchQuery || entry.message.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesLevel && matchesSearch;
      }),
    [logs, selectedLevel, searchQuery],
  );

  const handleExportLogs = async () => {
    if (logs.length === 0) {
      return;
    }
    try {
      const fullText = logs.map((l) => l.raw).join('\n');
      await SaveLog(fullText, 'txt');
      toast.success('Logcat buffer saved to disk');
    } catch (error) {
      toast.error(`Failed to export logs: ${String(error)}`);
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Terminal className="size-4.5 text-primary" />
            Live Logcat Buffer & Filter Studio
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {filteredLogs.length} / {logs.length} Lines
            </span>
          </div>
        </div>
        <CardDescription className="text-body text-muted-foreground">
          Query, filter, and inspect kernel/framework log output in real-time
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5 pt-1">
        {/* Logcat Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-md flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-caption"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs (e.g. tag, error, pid)…"
                value={searchQuery}
              />
            </div>

            <Select
              onValueChange={(val) => setSelectedLevel(val as LogLevel)}
              value={selectedLevel}
            >
              <SelectTrigger className="h-8 w-28 text-caption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="V">Verbose (V)</SelectItem>
                <SelectItem value="D">Debug (D)</SelectItem>
                <SelectItem value="I">Info (I)</SelectItem>
                <SelectItem value="W">Warning (W)</SelectItem>
                <SelectItem value="E">Error (E)</SelectItem>
                <SelectItem value="F">Fatal (F)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 gap-1.5 px-3 text-caption"
              disabled={isFetchingLogs || !isAdb}
              onClick={() => void fetchLogcatSnapshot()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className={cn('size-3.5', isFetchingLogs && 'animate-spin')} />
              Refresh
            </Button>

            <Button
              className="h-8 gap-1.5 px-3 text-caption"
              disabled={logs.length === 0}
              onClick={() => void handleExportLogs()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="size-3.5 text-muted-foreground" />
              Export .txt
            </Button>

            <Button
              className="h-8 gap-1.5 px-3 text-caption"
              disabled={logs.length === 0}
              onClick={() => setLogs([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
              Clear
            </Button>
          </div>
        </div>

        {/* Log Viewer Terminal Box */}
        <div
          className="max-h-[380px] min-h-[220px] overflow-y-auto rounded-lg border border-border/80 bg-background/90 p-3 font-mono text-[11px] text-muted-foreground leading-relaxed"
          ref={logScrollRef}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-caption text-muted-foreground">
              {isAdb
                ? 'No log entries match current filter.'
                : 'Connect an active ADB device to read logcat stream.'}
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                className={cn(
                  'flex items-start gap-2 py-0.5 hover:bg-surface-raised/30',
                  entry.level === 'E' || entry.level === 'F'
                    ? 'text-destructive'
                    : entry.level === 'W'
                      ? 'text-warning'
                      : entry.level === 'D'
                        ? 'text-info'
                        : 'text-foreground/90',
                )}
                key={entry.id}
              >
                <span className="shrink-0 select-none text-[10px] text-muted-foreground/60">
                  {entry.line.toString().padStart(4, '0')}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-bold',
                    entry.level === 'E' ? 'text-destructive' : 'text-primary',
                  )}
                >
                  [{entry.level}]
                </span>
                <span className="whitespace-pre-wrap break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
