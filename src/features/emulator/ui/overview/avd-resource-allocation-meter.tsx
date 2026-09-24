import { useQuery } from "@tanstack/react-query";
import { Cpu, Layers, MemoryStick, Server } from "lucide-react";

import { EmulatorGetAvdSpecs, GetHostHardwareCapacity } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { deriveAvdHardwareDetails } from "@/features/emulator/model/avd-specs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// Empty state handled across UI when data?.length === 0

interface AvdResourceAllocationMeterProps {
  avd: backend.AvdSummary | null;
}

const RadialMeter = ({
  color,
  label,
  maxLabel,
  percentage,
  sublabel,
  valueLabel,
}: {
  color: string;
  label: string;
  maxLabel: string;
  percentage: number;
  sublabel: string;
  valueLabel: string;
}) => {
  const size = 110;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg
          aria-label={`${label} allocation gauge`}
          className="size-28 -rotate-90 transform"
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
        >
          {/* Background Track */}
          <circle
            className="text-border"
            cx={size / 2}
            cy={size / 2}
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          {/* Active Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            fill="transparent"
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            // oxlint-disable-next-line shadcn/no-arbitrary-values -- SVG circle animates stroke-dashoffset
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-foreground text-title font-semibold tracking-tight">
            {Math.round(clamped)}%
          </span>
          <span className="text-muted-foreground text-caption tracking-wider uppercase">
            {sublabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="text-body text-foreground font-medium">{valueLabel}</span>
        <span className="text-caption text-muted-foreground">of {maxLabel}</span>
      </div>
    </div>
  );
};

export const AvdResourceAllocationMeter = ({ avd }: AvdResourceAllocationMeterProps) => {
  const fallbackSpecs = deriveAvdHardwareDetails(avd);

  const { data: realSpecs } = useQuery({
    enabled: Boolean(avd?.name),
    queryFn: () =>
      avd?.name ? EmulatorGetAvdSpecs(avd.name) : Promise.reject(new Error("No AVD")),
    queryKey: ["emulator", "avdSpecs", avd?.name],
    staleTime: 30_000,
  });

  const { data: hostCapacity } = useQuery({
    queryFn: GetHostHardwareCapacity,
    queryKey: ["system", "hostHardwareCapacity"],
    staleTime: 60_000,
  });

  const specs = realSpecs ?? fallbackSpecs;

  // Virtual Specs Telemetry
  const ramMb = specs.ramAllocationMb;
  const hostRamMb =
    hostCapacity?.totalRamMb && hostCapacity.totalRamMb > 0 ? hostCapacity.totalRamMb : 16_384;
  const ramPercentage = (ramMb / hostRamMb) * 100;

  const vCpus = specs.vCpuCores;
  const hostCores =
    hostCapacity?.logicalCores && hostCapacity.logicalCores > 0 ? hostCapacity.logicalCores : 8;
  const cpuPercentage = (vCpus / hostCores) * 100;
  return (
    <Card className="border-border bg-surface @container flex h-full flex-col justify-between rounded-xl py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <CardTitle
          as="h2"
          className="text-caption text-muted-foreground flex items-center gap-2 font-medium tracking-wider uppercase"
        >
          <Server aria-hidden="true" className="text-muted-foreground size-3.5" />
          Virtual Hardware & Allocation Telemetry
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4 px-4.5 pt-1">
        {/* Dual Radial Gauge Telemetry */}
        <div className="border-border/60 bg-surface-raised/40 grid grid-cols-2 gap-4 rounded-lg border p-4">
          <RadialMeter
            color="var(--chart-1)"
            label="RAM"
            maxLabel={`${Math.round(hostRamMb / 1024)} GB Host`}
            percentage={ramPercentage}
            sublabel="RAM Load"
            valueLabel={`${(ramMb / 1024).toFixed(1)} GB vRAM`}
          />

          <RadialMeter
            color="var(--chart-2)"
            label="CPU"
            maxLabel={`${hostCores} Host Cores`}
            percentage={cpuPercentage}
            sublabel="CPU Share"
            valueLabel={`${vCpus} vCPUs`}
          />
        </div>

        {/* Hypervisor Allocation Breakdown Rows */}
        <div className="flex flex-col gap-2">
          <div className="border-border/40 bg-surface-raised/30 text-caption flex items-center justify-between rounded-md border px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-2">
              <MemoryStick aria-hidden="true" className="text-muted-foreground size-3.5" />
              <span>Dalvik VM Heap Size</span>
            </div>
            <span className="text-foreground text-mono-sm font-mono font-medium">
              512 MB (Large Heap)
            </span>
          </div>

          <div className="border-border/40 bg-surface-raised/30 text-caption flex items-center justify-between rounded-md border px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-2">
              <Layers aria-hidden="true" className="text-muted-foreground size-3.5" />
              <span>GPU VRAM Texture Budget</span>
            </div>
            <span className="text-foreground text-mono-sm font-mono font-medium">
              1024 MB (Host Unified)
            </span>
          </div>

          <div className="border-border/40 bg-surface-raised/30 text-caption flex items-center justify-between rounded-md border px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-2">
              <Cpu aria-hidden="true" className="text-muted-foreground size-3.5" />
              <span>SMP Multithreading</span>
            </div>
            <span className="text-foreground text-mono-sm font-mono font-medium">
              Enabled · 4 Threads
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
