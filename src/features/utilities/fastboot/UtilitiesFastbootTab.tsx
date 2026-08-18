import { FastbootGetVarCard } from '@/features/utilities/fastboot/FastbootGetVarCard';
import { FastbootSlotControlCard } from '@/features/utilities/fastboot/FastbootSlotControlCard';

interface UtilitiesFastbootTabProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleFastbootGetVars: () => void;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  handleSetActiveSlot: (slot: string) => void;
  handleWipeData: () => void;
  isGlobalLoading: boolean;
  loadingAction: string | null;
  onRescan: () => void;
  sentAction: string | null;
}

export function UtilitiesFastbootTab({
  deviceMode,
  deviceSerial,
  handleReboot,
  handleSetActiveSlot,
  handleWipeData,
  isGlobalLoading,
  loadingAction,
  sentAction,
}: UtilitiesFastbootTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Fastboot Slot Switcher & Power Grid */}
      <FastbootSlotControlCard
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        handleReboot={handleReboot}
        handleSetActiveSlot={handleSetActiveSlot}
        handleWipeData={handleWipeData}
        isGlobalLoading={isGlobalLoading}
        loadingAction={loadingAction}
        sentAction={sentAction}
      />

      {/* 2. Fastboot getvar all Deep Inspector */}
      <FastbootGetVarCard deviceMode={deviceMode} deviceSerial={deviceSerial} />
    </div>
  );
}
