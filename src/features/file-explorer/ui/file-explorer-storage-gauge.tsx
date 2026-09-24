import { HardDrive } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GetDeviceTelemetry } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { Gauge } from "@/shared/charts/gauge";
import { Ring } from "@/shared/charts/ring";
import { RingChart } from "@/shared/charts/ring-chart";
import { useDeviceStore } from "@/shared/stores/device-store";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";

export interface FileExplorerStorageGaugeProps {
  className?: string;
  currentPath?: string;
  variant?: "gauge" | "ring";
}

export const FileExplorerStorageGauge = ({
  currentPath = "/",
  variant = "gauge",
  className,
}: FileExplorerStorageGaugeProps) => {
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const [volumes, setVolumes] = useState<backend.StorageVolume[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTelemetry = async () => {
      if (!selectedSerial || typeof GetDeviceTelemetry !== "function") {
        return;
      }
      try {
        const telemetry = await GetDeviceTelemetry(selectedSerial);
        if (isMounted && telemetry?.storage) {
          setVolumes(telemetry.storage);
        }
      } catch {
        // Ignore offline / aborted queries
      }
    };

    void loadTelemetry();

    return () => {
      isMounted = false;
    };
  }, [selectedSerial]);

  const volume = useMemo(() => {
    if (!selectedSerial || volumes.length === 0) {
      return null;
    }
    // Match specific volume by prefix
    const matched = volumes.find(
      (v) => v.mount && v.mount !== "/" && currentPath.startsWith(v.mount)
    );
    if (matched) {
      return matched;
    }
    // Fall back to /data (internal storage on Android) or first volume
    return volumes.find((v) => v.mount === "/data") ?? volumes[0] ?? null;
  }, [volumes, currentPath, selectedSerial]);

  if (!volume || volume.totalBytes <= 0) {
    return null;
  }

  const usedPercent = Math.min(
    100,
    Math.max(0, Math.round((volume.usedBytes / volume.totalBytes) * 100))
  );
  const totalFormatted = formatBytes(volume.totalBytes);
  const usedFormatted = formatBytes(volume.usedBytes);
  const freeFormatted = formatBytes(volume.freeBytes);

  return (
    <div
      aria-label={`Storage: ${usedPercent}% used (${usedFormatted} of ${totalFormatted})`}
      className={cn("flex items-center gap-2 select-none", className)}
      title={`Volume: ${volume.mount}\nUsed: ${usedFormatted} / ${totalFormatted} (${usedPercent}%)\nFree: ${freeFormatted}`}
    >
      <HardDrive aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
      {variant === "ring" ? (
        <RingChart
          baseInnerRadius={6}
          className="shrink-0"
          data={[
            {
              color: "var(--chart-1)",
              label: "Storage",
              maxValue: 100,
              value: usedPercent,
            },
          ]}
          ringGap={0}
          size={22}
          strokeWidth={3}
        >
          <Ring index={0} lineCap="round" />
        </RingChart>
      ) : (
        <Gauge
          activeFill="var(--chart-1)"
          className="shrink-0"
          height={10}
          inactiveFill="var(--border)"
          linearHeight={10}
          notchCornerRadius={1}
          orientation="linear"
          spacing={18}
          totalNotches={12}
          uniformWidth
          value={usedPercent}
          width={64}
        />
      )}
      <div className="text-caption flex items-center gap-1 tabular-nums">
        <span className="text-foreground font-semibold">{usedPercent}%</span>
        <span className="text-muted-foreground hidden @lg:inline">({freeFormatted} free)</span>
      </div>
    </div>
  );
};
