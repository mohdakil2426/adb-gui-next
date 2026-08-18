import { Power, RefreshCw, Server } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface HostServerControlCardProps {
  handleKillServer: () => void;
  handleRestartServer: () => void;
  loadingAction: string | null;
  sentAction?: string | null;
  versions: { adb?: string; fastboot?: string } | undefined;
}

export function HostServerControlCard({
  handleKillServer,
  handleRestartServer,
  loadingAction,
  sentAction: _sentAction,
  versions,
}: HostServerControlCardProps) {
  const [pendingKill, setPendingKill] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Server className="size-4.5 text-primary" />
            Host ADB Server Controls
          </CardTitle>
          <Badge className="font-mono text-[10px]" variant="success">
            Port 5037 Active
          </Badge>
        </div>
        <CardDescription className="text-body text-muted-foreground">
          Manage the background ADB daemon process communicating with local USB and network
          endpoints
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        {/* Version info readouts */}
        <div className="grid @lg:grid-cols-2 @xs:grid-cols-1 gap-3">
          <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              ADB Server Binary
            </span>
            <span className="truncate font-medium font-mono text-body text-foreground">
              {versions?.adb || 'Android Debug Bridge (Bundled)'}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Fastboot Tool Binary
            </span>
            <span className="truncate font-medium font-mono text-body text-foreground">
              {versions?.fastboot || 'Fastboot Tool (Bundled)'}
            </span>
          </div>
        </div>

        {/* Server Actions */}
        <div className="grid @lg:grid-cols-2 @xs:grid-cols-1 gap-3 border-border/50 border-t pt-3">
          <Button
            className="h-12 justify-start gap-3 p-3 text-left"
            disabled={Boolean(loadingAction)}
            onClick={() => setPendingRestart(true)}
            type="button"
            variant="outline"
          >
            <RefreshCw
              className={cn('size-4.5', loadingAction === 'restart-server' && 'animate-spin')}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Restart ADB Server</span>
              <span className="text-caption text-muted-foreground">
                Kill and respawn host daemon
              </span>
            </div>
          </Button>

          <Button
            className="h-12 justify-start gap-3 p-3 text-left"
            disabled={Boolean(loadingAction)}
            onClick={() => setPendingKill(true)}
            type="button"
            variant="outline"
          >
            <Power className="size-4.5 text-destructive" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Kill ADB Server</span>
              <span className="text-caption text-muted-foreground">
                Terminate background adb.exe
              </span>
            </div>
          </Button>
        </div>
      </CardContent>

      {/* Confirm Kill */}
      <ConfirmDialog
        confirmLabel="Kill ADB Server"
        consequence={
          <p>All active ADB sessions, logcat streams, and wireless connections will be closed.</p>
        }
        description="Are you sure you want to kill the host ADB server process?"
        onConfirm={() => {
          setPendingKill(false);
          handleKillServer();
        }}
        onOpenChange={setPendingKill}
        open={pendingKill}
        title="Kill ADB Server"
      />

      {/* Confirm Restart */}
      <ConfirmDialog
        confirmLabel="Restart Server"
        consequence={<p>The host server daemon will be killed and restarted on TCP port 5037.</p>}
        description="Restart host ADB server daemon?"
        onConfirm={() => {
          setPendingRestart(false);
          handleRestartServer();
        }}
        onOpenChange={setPendingRestart}
        open={pendingRestart}
        title="Restart ADB Server"
      />
    </Card>
  );
}
