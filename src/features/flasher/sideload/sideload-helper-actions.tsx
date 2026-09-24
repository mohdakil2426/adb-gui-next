import { RefreshCw, RotateCcw, Smartphone, Zap } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

interface SideloadHelperActionsProps {
  disabled?: boolean;
  isSideloadActive: boolean;
  onCheckState: () => void;
  onRebootRecovery: () => void;
  onRebootSystem: () => void;
  serial: string | null;
}

export const SideloadHelperActions = ({
  serial,
  isSideloadActive,
  onRebootRecovery,
  onRebootSystem,
  onCheckState,
  disabled = false,
}: SideloadHelperActionsProps) => (
  <Card className="border-border bg-surface flex flex-col justify-between rounded-xl shadow-none">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-foreground text-title flex items-center gap-2">
          <Zap className="text-muted-foreground size-5" />
          Sideload Helper Utilities
        </CardTitle>
        <Badge variant={isSideloadActive ? "success" : "outline"}>
          {isSideloadActive ? "Sideload Active" : "Waiting for Recovery"}
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
          <div className="text-body text-foreground flex items-center gap-1.5 font-semibold">
            <RotateCcw aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            Reboot to Recovery
          </div>
          <span className="text-muted-foreground text-[11px]">
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
          <div className="text-body text-foreground flex items-center gap-1.5 font-semibold">
            <RefreshCw aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            Check Sideload State
          </div>
          <span className="text-muted-foreground text-[11px]">
            Scans for active ADB sideload handshake
          </span>
        </Button>
      </div>

      {/* Action 3: Reboot System */}
      <Button
        className="text-caption w-full justify-center gap-1.5"
        disabled={disabled || !serial}
        onClick={onRebootSystem}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Smartphone aria-hidden="true" className="size-3.5" data-icon="inline-start" />
        Reboot to System OS (Finish Sideload)
      </Button>

      <div className="border-border/70 bg-background/50 text-muted-foreground rounded-lg border p-2.5 text-[11px]">
        <p className="text-foreground font-semibold">💡 How to initiate Sideload on device:</p>
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
