import { RefreshCw, RotateCcw, Smartphone, Zap } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

interface SideloadHelperActionsProps {
  disabled?: boolean;
  isSideloadActive: boolean;
  onCheckState: () => void;
  onRebootRecovery: () => void;
  onRebootSystem: () => void;
  serial: string | null;
}

export function SideloadHelperActions({
  serial,
  isSideloadActive,
  onRebootRecovery,
  onRebootSystem,
  onCheckState,
  disabled = false,
}: SideloadHelperActionsProps) {
  return (
    <Card className="flex flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Zap className="size-5 text-muted-foreground" />
            Sideload Helper Utilities
          </CardTitle>
          <Badge variant={isSideloadActive ? 'success' : 'outline'}>
            {isSideloadActive ? 'Sideload Active' : 'Waiting for Recovery'}
          </Badge>
        </div>
        <CardDescription className="text-caption">
          Quick actions to put the device into recovery sideload mode and reboot afterwards.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Action 1: Reboot Recovery */}
          <Button
            className="h-auto flex-col items-start gap-1 p-3 text-left"
            disabled={disabled || !serial}
            onClick={onRebootRecovery}
            size="sm"
            type="button"
            variant="outline"
          >
            <div className="flex items-center gap-1.5 font-semibold text-body text-foreground">
              <RotateCcw aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Reboot to Recovery
            </div>
            <span className="text-[11px] text-muted-foreground">
              Prepares device for &quot;Apply update from ADB&quot;
            </span>
          </Button>

          {/* Action 2: Check Sideload State */}
          <Button
            className="h-auto flex-col items-start gap-1 p-3 text-left"
            disabled={disabled || !serial}
            onClick={onCheckState}
            size="sm"
            type="button"
            variant="outline"
          >
            <div className="flex items-center gap-1.5 font-semibold text-body text-foreground">
              <RefreshCw aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Check Sideload State
            </div>
            <span className="text-[11px] text-muted-foreground">
              Scans for active ADB sideload handshake
            </span>
          </Button>
        </div>

        {/* Action 3: Reboot System */}
        <Button
          className="w-full justify-center gap-1.5 text-caption"
          disabled={disabled || !serial}
          onClick={onRebootSystem}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Smartphone aria-hidden="true" className="size-3.5" data-icon="inline-start" />
          Reboot to System OS (Finish Sideload)
        </Button>

        <div className="rounded-lg border border-border/70 bg-background/50 p-2.5 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">💡 How to initiate Sideload on device:</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>Reboot device into Recovery mode.</li>
            <li>Use volume keys to navigate to &quot;Apply update&quot;.</li>
            <li>Select &quot;Apply from ADB&quot; and press Power.</li>
            <li>The device status will switch to &quot;sideload&quot;.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
