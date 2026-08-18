import { type LucideIcon, Power, RotateCcw, Terminal, Tv, Wrench, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { ScrcpyLaunch } from '@/desktop/backend';
import { REBOOT_LABEL, type RebootTarget } from '@/features/dashboard/hooks/useRebootActions';
import type { DeviceMode } from '@/features/dashboard/model/deviceMode';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { DEFAULT_SCRCPY_OPTIONS } from '@/features/scrcpy/model/defaults';
import { Button } from '@/shared/ui/button';

interface QuickActionsPanelProps {
  isDisabled: boolean;
  mode: DeviceMode;
  onOpenShell: () => void;
  onReboot: (target: RebootTarget) => void;
  runningTarget: RebootTarget | null;
  serial?: string | undefined;
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
  serial,
}: QuickActionsPanelProps) {
  const targets = mode === 'fastboot' ? FASTBOOT_TARGETS : ADB_TARGETS;

  const handleMirror = async () => {
    if (!serial) {
      return;
    }
    try {
      await ScrcpyLaunch(DEFAULT_SCRCPY_OPTIONS, serial);
      toast.success('Launched Scrcpy Mirror', { description: `Target: ${serial}` });
    } catch (err) {
      toast.error('Failed to launch mirror', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };
  return (
    <PanelCard icon={Zap} title="Quick actions">
      <div className="grid @xs:grid-cols-2 grid-cols-1 gap-2">
        {mode === 'adb' ? (
          <>
            <Button
              className="justify-start"
              disabled={isDisabled || !serial}
              onClick={handleMirror}
              size="sm"
              type="button"
              variant="outline"
            >
              <Tv aria-hidden="true" className="size-3.5" />
              Screen Mirror
            </Button>

            <Button
              className="justify-start"
              onClick={onOpenShell}
              size="sm"
              type="button"
              variant="outline"
            >
              <Terminal aria-hidden="true" className="size-3.5" />
              Open Shell
            </Button>
          </>
        ) : null}

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
              <Icon aria-hidden="true" className="size-3.5" />
              {REBOOT_LABEL[target]}
            </Button>
          );
        })}
      </div>
    </PanelCard>
  );
}
