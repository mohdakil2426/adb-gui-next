import { RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GetHostToolVersions } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { ActionButton } from '@/shared/components/ActionButton';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function HostToolsPanel({
  handleKillServer,
  handleRestartServer,
  loadingAction,
  sentAction,
}: {
  handleKillServer: () => void;
  handleRestartServer: () => void;
  loadingAction: string | null;
  sentAction: string | null;
}) {
  const [versions, setVersions] = useState<backend.HostToolVersions | null>(null);
  const [pendingKill, setPendingKill] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void GetHostToolVersions()
      .then((next) => {
        if (!cancelled) {
          setVersions(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersions(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sentAction]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server />
          Host ADB
        </CardTitle>
        <CardDescription>
          Controls the ADB server on this computer. Device connections go through it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground uppercase tracking-wide">adb</dt>
            <dd className="font-mono text-foreground text-mono-sm">
              {versions?.adb ?? 'Reading bundled tools…'}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground uppercase tracking-wide">fastboot</dt>
            <dd className="font-mono text-foreground text-mono-sm">
              {versions?.fastboot ?? 'Reading bundled tools…'}
            </dd>
          </div>
        </dl>

        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
          <ActionButton
            actionId="restart_server"
            icon={RefreshCw}
            justifyStart
            label="Restart ADB Server"
            loadingAction={loadingAction}
            onClick={() => {
              setPendingRestart(true);
            }}
            sentAction={sentAction}
            variant="outline"
          />
          <ActionButton
            actionId="kill_server"
            className="hover:bg-destructive/10 hover:text-destructive"
            icon={Server}
            justifyStart
            label="Kill ADB Server"
            loadingAction={loadingAction}
            onClick={() => {
              setPendingKill(true);
            }}
            sentAction={sentAction}
            variant="outline"
          />
        </div>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Restart ADB Server"
        consequence={<p>Every connected device drops for a moment, then the app rescans.</p>}
        description="Stops and starts the local adb server in one step."
        destructive={false}
        onConfirm={() => {
          setPendingRestart(false);
          handleRestartServer();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRestart(false);
          }
        }}
        open={pendingRestart}
        title="Restart the ADB server?"
      />

      <ConfirmDialog
        confirmLabel="Kill ADB Server"
        consequence={
          <p>
            Every device in this app disconnects until the server is started again. Prefer Restart
            unless you specifically need the server stopped.
          </p>
        }
        description="Stops the local adb server. This app talks to every device through it."
        onConfirm={() => {
          setPendingKill(false);
          handleKillServer();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingKill(false);
          }
        }}
        open={pendingKill}
        title="Kill the ADB server?"
      />
    </Card>
  );
}
