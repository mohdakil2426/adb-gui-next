import { PanelRight, Smartphone, Square } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScrcpyCloseToolbar, ScrcpyOpenToolbar } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { handleError } from '@/shared/utils/errorHandler';

interface ActiveSessionControllerProps {
  activeSerials: Set<string>;
  isStopping: boolean;
  onStopDevice: (serial: string) => void;
  sessions?: backend.ScrcpySessionInfo[] | undefined;
}

export function ActiveSessionController({
  activeSerials,
  isStopping,
  onStopDevice,
  sessions = [],
}: ActiveSessionControllerProps) {
  const nicknames = useNicknameStore((state) => state.nicknames);
  const [openToolbars, setOpenToolbars] = useState<Set<string>>(new Set());

  const serialList = Array.from(activeSerials).filter((s) => s !== '*');

  const handleToggleToolbar = async (serial: string) => {
    try {
      if (openToolbars.has(serial)) {
        await ScrcpyCloseToolbar(serial);
        setOpenToolbars((prev) => {
          const next = new Set(prev);
          next.delete(serial);
          return next;
        });
        toast.info(`Closed floating toolbar for ${nicknames[serial] ?? serial}`);
      } else {
        const session = sessions.find((s) => s.serial === serial);
        await ScrcpyOpenToolbar(serial, session?.pid ?? null, 'freeform');
        setOpenToolbars((prev) => new Set([...prev, serial]));
        toast.success(`Opened companion floating toolbar for ${nicknames[serial] ?? serial}`);
      }
    } catch (error) {
      handleError('Toggle floating toolbar', error);
    }
  };

  if (serialList.length === 0) {
    return null;
  }

  return (
    <Card className="border-emerald-500/20 bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <CardTitle className="font-semibold text-body text-foreground">
              Active Mirroring Sessions ({serialList.length})
            </CardTitle>
          </div>
          <Badge
            className="border-emerald-500/30 bg-emerald-500/10 text-caption text-emerald-400"
            variant="outline"
          >
            Live Hardware Stream
          </Badge>
        </div>
        <CardDescription className="text-caption text-muted-foreground">
          Monitor running mirroring windows, stop specific devices, or spawn floating desktop action
          toolbars.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {serialList.map((serial) => {
            const displayName = nicknames[serial] ?? serial;
            const session = sessions.find((s) => s.serial === serial);
            const isToolbarOpen = openToolbars.has(serial);

            return (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/50 p-3"
                key={serial}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Smartphone aria-hidden="true" className="size-4 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-body text-foreground">
                        {displayName}
                      </span>
                      {session?.pid ? (
                        <span className="rounded bg-surface px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                          PID {session.pid}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-caption text-muted-foreground">
                      {serial}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-7 gap-1.5 px-2.5 text-caption"
                        onClick={() => handleToggleToolbar(serial)}
                        size="sm"
                        type="button"
                        variant={isToolbarOpen ? 'secondary' : 'outline'}
                      >
                        <PanelRight
                          aria-hidden="true"
                          className="size-3.5"
                          data-icon="inline-start"
                        />
                        <span>{isToolbarOpen ? 'Hide Toolbar' : 'Floating Toolbar'}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Spawn companion floating pill toolbar with quick shortcuts
                    </TooltipContent>
                  </Tooltip>

                  <Button
                    className="h-7 gap-1 px-2.5 text-caption hover:bg-destructive/10 hover:text-destructive"
                    disabled={isStopping}
                    onClick={() => onStopDevice(serial)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Square aria-hidden="true" className="size-3" data-icon="inline-start" />
                    <span>Stop Mirror</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
