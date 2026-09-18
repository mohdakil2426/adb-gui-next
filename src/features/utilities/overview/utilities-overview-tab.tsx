import { AdbTransportGuideCard } from "@/features/utilities/overview/adb-transport-guide-card";
import { InstantActionsCard } from "@/features/utilities/overview/instant-actions-card";

interface UtilitiesOverviewTabProps {
  deviceMode: "adb" | "fastboot" | "unknown";
  deviceSerial: string | null;
  onNavigateTab: (tab: "power" | "diagnostics" | "fastboot" | "host") => void;
}

export const UtilitiesOverviewTab = ({
  deviceMode,
  deviceSerial,
  onNavigateTab,
}: UtilitiesOverviewTabProps) => (
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
