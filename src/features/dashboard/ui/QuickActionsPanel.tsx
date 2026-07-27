import { type LucideIcon, Power, RotateCcw, Terminal, Wrench, Zap } from 'lucide-react';
import { REBOOT_LABEL, type RebootTarget } from '@/features/dashboard/hooks/useRebootActions';
import type { DeviceMode } from '@/features/dashboard/model/deviceMode';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { Button } from '@/shared/ui/button';

interface QuickActionsPanelProps {
  isDisabled: boolean;
  mode: DeviceMode;
  onOpenShell: () => void;
  onReboot: (target: RebootTarget) => void;
  runningTarget: RebootTarget | null;
}

const REBOOT_ICON: Record<RebootTarget, LucideIcon> = {
  system: Power,
  bootloader: Zap,
  recovery: RotateCcw,
  fastboot: Wrench,
};

/** fastbootd is a userspace mode that only exists once Android has booted. */
const ADB_TARGETS: RebootTarget[] = ['system', 'bootloader', 'recovery', 'fastboot'];
const FASTBOOT_TARGETS: RebootTarget[] = ['system', 'bootloader', 'recovery'];

export function QuickActionsPanel({
  isDisabled,
  mode,
  onOpenShell,
  onReboot,
  runningTarget,
}: QuickActionsPanelProps) {
  const targets = mode === 'fastboot' ? FASTBOOT_TARGETS : ADB_TARGETS;

  return (
    <PanelCard icon={Zap} title="Quick actions">
      <div className="grid @xs:grid-cols-2 grid-cols-1 gap-2">
        {targets.map((target) => {
          const Icon = REBOOT_ICON[target];
          return (
            <Button
              className="justify-start"
              disabled={isDisabled || runningTarget !== null}
              key={target}
              onClick={() => {
                onReboot(target);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon aria-hidden="true" />
              {REBOOT_LABEL[target]}
            </Button>
          );
        })}

        {mode === 'adb' ? (
          <Button
            className="col-span-2 justify-start"
            onClick={onOpenShell}
            size="sm"
            type="button"
            variant="outline"
          >
            <Terminal aria-hidden="true" />
            Open shell
          </Button>
        ) : null}
      </div>

      <p className="mt-2 text-caption text-muted-foreground">
        {mode === 'fastboot'
          ? 'Fastboot mode — reboot targets are sent with fastboot.'
          : 'Reboot targets other than System ask for confirmation.'}
      </p>
    </PanelCard>
  );
}
