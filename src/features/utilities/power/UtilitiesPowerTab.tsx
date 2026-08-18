import { SystemTweaksCard } from '@/features/utilities/power/SystemTweaksCard';
import { TargetRebootCard } from '@/features/utilities/power/TargetRebootCard';

interface UtilitiesPowerTabProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  loadingAction: string | null;
  sentAction: string | null;
}

export function UtilitiesPowerTab({
  deviceMode,
  deviceSerial,
  handleReboot,
  loadingAction,
  sentAction,
}: UtilitiesPowerTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Symmetrical Target Reboot Grid */}
      <TargetRebootCard
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        handleReboot={handleReboot}
        loadingAction={loadingAction}
        sentAction={sentAction}
      />

      {/* 2. Android System Tweaks & Modifiers */}
      <SystemTweaksCard deviceMode={deviceMode} deviceSerial={deviceSerial} />
    </div>
  );
}
