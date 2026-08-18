import { LogcatStreamCard } from '@/features/utilities/diagnostics/LogcatStreamCard';
import { ScreenshotStudioCard } from '@/features/utilities/diagnostics/ScreenshotStudioCard';

interface UtilitiesDiagnosticsTabProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
}

export function UtilitiesDiagnosticsTab({
  deviceMode,
  deviceSerial,
}: UtilitiesDiagnosticsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Device Screenshot Studio */}
      <ScreenshotStudioCard deviceMode={deviceMode} deviceSerial={deviceSerial} />

      {/* 2. Live Logcat Buffer & Filter Studio */}
      <LogcatStreamCard deviceMode={deviceMode} deviceSerial={deviceSerial} />
    </div>
  );
}
