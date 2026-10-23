import { LogcatStreamCard } from "@/features/utilities/diagnostics/logcat-stream-card";

interface UtilitiesDiagnosticsTabProps {
  deviceMode: "adb" | "fastboot" | "unknown";
  deviceSerial: string | null;
}

export const UtilitiesDiagnosticsTab = ({
  deviceMode,
  deviceSerial,
}: UtilitiesDiagnosticsTabProps) => (
  <div className="flex flex-col gap-6">
    {/* Live Logcat Buffer & Filter Studio */}
    <LogcatStreamCard deviceMode={deviceMode} deviceSerial={deviceSerial} />
  </div>
);
