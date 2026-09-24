import { PanelRight, Smartphone, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScrcpyCloseToolbar, ScrcpyOpenToolbar } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { useNicknameStore } from "@/shared/stores/nickname-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { handleError } from "@/shared/utils/error-handler";

interface ActiveSessionControllerProps {
  activeSerials: Set<string>;
  isStopping: boolean;
  onStopDevice: (serial: string) => void;
  sessions?: backend.ScrcpySessionInfo[] | undefined;
}

const EMPTY_SESSIONS: backend.ScrcpySessionInfo[] = [];

export const ActiveSessionController = ({
  activeSerials,
  isStopping,
  onStopDevice,
  sessions = EMPTY_SESSIONS,
}: ActiveSessionControllerProps) => {
  const nicknames = useNicknameStore((state) => state.nicknames);
  const [openToolbars, setOpenToolbars] = useState<Set<string>>(new Set());

  const serialList = [...activeSerials].filter((s) => s !== "*");

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
        await ScrcpyOpenToolbar(serial, session?.pid ?? null, "freeform");
        setOpenToolbars((prev) => new Set([...prev, serial]));
        toast.success(`Opened companion floating toolbar for ${nicknames[serial] ?? serial}`);
      }
    } catch (error) {
      handleError("Toggle floating toolbar", error);
    }
  };

  if (serialList.length === 0) {
    return null;
  }

  return (
    <Card className="bg-surface border-success/20 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-success relative inline-flex size-2.5 rounded-full" />
            </span>
            <CardTitle className="text-body text-foreground font-semibold">
              Active Mirroring Sessions ({serialList.length})
            </CardTitle>
          </div>
          <Badge
            className="text-caption border-success/30 bg-success/10 text-success"
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
                className="border-border/80 bg-surface-raised/50 flex items-center justify-between gap-3 rounded-lg border p-3"
                key={serial}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Smartphone aria-hidden="true" className="text-success size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body text-foreground truncate font-medium">
                        {displayName}
                      </span>
                      {session?.pid ? (
                        <span className="bg-surface text-muted-foreground text-mono-sm rounded px-1.5 py-0.5 font-mono">
                          PID {session.pid}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-caption text-muted-foreground truncate font-mono">
                      {serial}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="text-caption h-7 gap-1.5 px-2.5"
                        onClick={() => handleToggleToolbar(serial)}
                        size="sm"
                        type="button"
                        variant={isToolbarOpen ? "secondary" : "outline"}
                      >
                        <PanelRight
                          aria-hidden="true"
                          className="size-3.5"
                          data-icon="inline-start"
                        />
                        <span>{isToolbarOpen ? "Hide Toolbar" : "Floating Toolbar"}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Spawn companion floating pill toolbar with quick shortcuts
                    </TooltipContent>
                  </Tooltip>

                  <Button
                    className="text-caption hover:bg-destructive/10 hover:text-destructive h-7 gap-1 px-2.5"
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
};
