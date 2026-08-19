import { AdbTransportGuideCard } from '@/features/utilities/overview/AdbTransportGuideCard';
import { InstantActionsCard } from '@/features/utilities/overview/InstantActionsCard';

interface UtilitiesOverviewTabProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  onNavigateTab: (tab: 'power' | 'diagnostics' | 'fastboot' | 'host') => void;
}

export function UtilitiesOverviewTab({
  deviceMode,
  deviceSerial,
  onNavigateTab,
}: UtilitiesOverviewTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Instant Action Command Cockpit */}
      <InstantActionsCard
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        onNavigateTab={onNavigateTab}
      />

      {/* 2. ADB Transport & Socket Architecture Guide */}
      <AdbTransportGuideCard />
    </div>
  );
}
