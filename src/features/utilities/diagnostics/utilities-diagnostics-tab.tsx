import { LogcatStreamCard } from "@/features/utilities/diagnostics/logcat-stream-card";
import { ScreenshotStudioCard } from "@/features/utilities/diagnostics/screenshot-studio-card";

interface UtilitiesDiagnosticsTabProps {
  deviceMode: "adb" | "fastboot" | "unknown";
  deviceSerial: string | null;
}

export const UtilitiesDiagnosticsTab = ({
  deviceMode,
  deviceSerial,
}: UtilitiesDiagnosticsTabProps) => (
  <div className="flex flex-col gap-6">
    {/* 1. Device Screenshot Studio */}
    <ScreenshotStudioCard deviceMode={deviceMode} deviceSerial={deviceSerial} />

    {/* 2. Live Logcat Buffer & Filter Studio */}
    <LogcatStreamCard deviceMode={deviceMode} deviceSerial={deviceSerial} />
  </div>
);
