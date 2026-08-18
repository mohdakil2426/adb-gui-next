import { AlertTriangle, Settings2 } from 'lucide-react';
import type { backend } from '@/desktop/models';
import {
  LAUNCH_OPTIONS,
  type LaunchOptionKey,
  unacknowledgedLaunchOptions,
} from '@/features/emulator/model/launchOptions';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Switch } from '@/shared/ui/switch';

interface LaunchFlagsCardProps {
  launchAcknowledgements: Record<string, boolean>;
  launchOptions: backend.EmulatorLaunchOptions;
  onAcknowledge: (key: LaunchOptionKey, value: boolean) => void;
  onToggleOption: (key: keyof backend.EmulatorLaunchOptions, value: boolean) => void;
}

export function LaunchFlagsCard({
  launchAcknowledgements,
  launchOptions,
  onAcknowledge,
  onToggleOption,
}: LaunchFlagsCardProps) {
  const unacknowledged = unacknowledgedLaunchOptions(launchOptions, launchAcknowledgements);

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground text-title">
          <Settings2 className="size-5 text-muted-foreground" />
          Hardware & Virtualization Launch Flags
        </CardTitle>
        <CardDescription className="text-caption">
          Fine-tune the QEMU / AVD emulator startup parameters and runtime SELinux environments.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid @lg:grid-cols-2 gap-3.5">
          {LAUNCH_OPTIONS.map((opt) => {
            const isChecked = Boolean(launchOptions[opt.key]);
            const isHazard = opt.destructive;

            return (
              <div
                className="flex flex-col justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5"
                key={opt.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-body text-foreground">{opt.label}</span>
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
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-caption text-destructive">
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
          <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-3 text-caption text-warning">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Please acknowledge {unacknowledged.map((o) => o.label).join(', ')} above to enable
              launch.
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
