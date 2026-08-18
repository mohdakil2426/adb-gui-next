import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { GetDeviceTelemetry, RunShellCommand } from '@/desktop/backend';
import { AdbTransportGuideCard } from '@/features/utilities/overview/AdbTransportGuideCard';
import { DeviceVitalsCard } from '@/features/utilities/overview/DeviceVitalsCard';
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
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);

  // Fetch live telemetry for vitals matrix
  const {
    data: telemetry,
    isLoading: isTelemetryLoading,
    refetch: refetchTelemetry,
  } = useQuery({
    enabled: isAdb,
    queryFn: async () => {
      if (!deviceSerial) {
        return null;
      }
      return GetDeviceTelemetry(deviceSerial);
    },
    queryKey: ['utilities', 'vitals', deviceSerial],
    staleTime: 15_000,
  });

  // Query extra live vitals (display size & density)
  const { data: displayVitals, refetch: refetchDisplayVitals } = useQuery({
    enabled: isAdb,
    queryFn: async () => {
      if (!deviceSerial) {
        return null;
      }
      try {
        const [sizeOut, densityOut] = await Promise.all([
          RunShellCommand('wm size', deviceSerial).catch(() => ''),
          RunShellCommand('wm density', deviceSerial).catch(() => ''),
        ]);
        const sizeMatch =
          sizeOut.match(/Physical size:\s*([0-9x]+)/i) || sizeOut.match(/([0-9]+x[0-9]+)/i);
        const densityMatch =
          densityOut.match(/Physical density:\s*([0-9]+)/i) || densityOut.match(/([0-9]+)/i);
        return {
          dpi: densityMatch ? `${densityMatch[1]} DPI` : 'Auto',
          resolution: sizeMatch ? sizeMatch[1] : 'Auto',
        };
      } catch {
        return { dpi: 'Standard DPI', resolution: 'Standard' };
      }
    },
    queryKey: ['utilities', 'displayVitals', deviceSerial],
    staleTime: 60_000,
  });

  const handleRefreshVitals = useCallback(() => {
    void refetchTelemetry();
    void refetchDisplayVitals();
  }, [refetchTelemetry, refetchDisplayVitals]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Device Vitals & Diagnostics Grid */}
      <DeviceVitalsCard
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        displayVitals={displayVitals ?? undefined}
        isLoading={isTelemetryLoading}
        onRefresh={handleRefreshVitals}
        telemetry={telemetry}
      />

      {/* 2. Instant Action Command Cockpit */}
      <InstantActionsCard
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        onNavigateTab={onNavigateTab}
      />

      {/* 3. ADB Transport & Socket Architecture Guide */}
      <AdbTransportGuideCard />
    </div>
  );
}
