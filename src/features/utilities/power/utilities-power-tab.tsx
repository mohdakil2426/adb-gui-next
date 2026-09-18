import { SystemTweaksCard } from "@/features/utilities/power/system-tweaks-card";
import { TargetRebootCard } from "@/features/utilities/power/target-reboot-card";

interface UtilitiesPowerTabProps {
  deviceMode: "adb" | "fastboot" | "unknown";
  deviceSerial: string | null;
  handleReboot: (
    mode: string,
    modeId: "system" | "recovery" | "bootloader" | "fastboot" | null,
    actionId: string
  ) => void;
  loadingAction: string | null;
  sentAction: string | null;
}

export const UtilitiesPowerTab = ({
  deviceMode,
  deviceSerial,
  handleReboot,
  loadingAction,
  sentAction,
}: UtilitiesPowerTabProps) => (
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
