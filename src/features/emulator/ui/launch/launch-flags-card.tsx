import { AlertTriangle, Settings2 } from "lucide-react";

import type { backend } from "@/desktop/models";
import {
  LAUNCH_OPTIONS,
  unacknowledgedLaunchOptions,
} from "@/features/emulator/model/launch-options";
import type { LaunchOptionKey } from "@/features/emulator/model/launch-options";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";

interface LaunchFlagsCardProps {
  launchAcknowledgements: Record<string, boolean>;
  launchOptions: backend.EmulatorLaunchOptions;
  onAcknowledge: (key: LaunchOptionKey, value: boolean) => void;
  onToggleOption: (key: keyof backend.EmulatorLaunchOptions, value: boolean) => void;
}

export const LaunchFlagsCard = ({
  launchAcknowledgements,
  launchOptions,
  onAcknowledge,
  onToggleOption,
}: LaunchFlagsCardProps) => {
  const unacknowledged = unacknowledgedLaunchOptions(launchOptions, launchAcknowledgements);

  return (
    <Card className="border-border bg-surface rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-title flex items-center gap-2">
          <Settings2 className="text-muted-foreground size-5" />
          Hardware & Virtualization Launch Flags
        </CardTitle>
        <CardDescription className="text-caption">
          Fine-tune the QEMU / AVD emulator startup parameters and runtime SELinux environments.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3.5 @lg:grid-cols-2">
          {LAUNCH_OPTIONS.map((opt) => {
            const isChecked = Boolean(launchOptions[opt.key]);
            const isHazard = opt.destructive;

            return (
              <div
                className="border-border/80 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5"
                key={opt.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-body text-foreground font-semibold">{opt.label}</span>
                      {isHazard ? (
                        <Badge className="text-[10px]" variant="destructive">
                          Safety Interlock
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-caption text-muted-foreground">{opt.description}</p>
                  </div>

                  <Switch
                    aria-label={`Toggle ${opt.label}`}
                    checked={isChecked}
                    onCheckedChange={(val) => onToggleOption(opt.key, val)}
                  />
                </div>

                {isHazard && isChecked ? (
                  <div className="border-destructive/30 bg-destructive/5 text-caption text-destructive flex items-center gap-2 rounded-md border p-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <Checkbox
                      checked={Boolean(launchAcknowledgements[opt.key])}
                      id={`hazard-${opt.key}`}
                      onCheckedChange={(val) => onAcknowledge(opt.key, Boolean(val))}
                    />
                    <label className="cursor-pointer font-medium" htmlFor={`hazard-${opt.key}`}>
                      I acknowledge the risks of this launch flag.
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {unacknowledged.length > 0 ? (
          <div className="border-warning/40 bg-warning/5 text-caption text-warning flex items-center gap-2.5 rounded-lg border p-3">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Please acknowledge {unacknowledged.map((o) => o.label).join(", ")} above to enable
              launch.
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
