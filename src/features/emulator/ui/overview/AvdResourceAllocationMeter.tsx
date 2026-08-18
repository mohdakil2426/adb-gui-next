import { Cpu, Layers, MemoryStick, Server } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { deriveAvdHardwareDetails } from '@/features/emulator/model/avdSpecs';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface AvdResourceAllocationMeterProps {
  avd: backend.AvdSummary | null;
}

function RadialMeter({
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
}) {
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
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-semibold text-foreground text-title tracking-tight">
            {Math.round(clamped)}%
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {sublabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="font-medium text-body text-foreground">{valueLabel}</span>
        <span className="text-caption text-muted-foreground">of {maxLabel}</span>
      </div>
    </div>
  );
}

export function AvdResourceAllocationMeter({ avd }: AvdResourceAllocationMeterProps) {
  const specs = deriveAvdHardwareDetails(avd);

  // Virtual Specs Telemetry
  const ramMb = specs.ramAllocationMb;
  const hostRamMb = 16_384;
  const ramPercentage = (ramMb / hostRamMb) * 100;

  const vCpus = specs.vCpuCores;
  const hostCores = 8;
  const cpuPercentage = (vCpus / hostCores) * 100;

  return (
    <Card className="@container flex h-full flex-col justify-between rounded-xl border-border bg-surface py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <CardTitle
          as="h2"
          className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
        >
          <Server aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Virtual Hardware & Allocation Telemetry
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4 px-4.5 pt-1">
        {/* Dual Radial Gauge Telemetry */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-surface-raised/40 p-4">
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
          <div className="flex items-center justify-between rounded-md border border-border/40 bg-surface-raised/30 px-3 py-2 text-caption">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MemoryStick aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>Dalvik VM Heap Size</span>
            </div>
            <span className="font-medium font-mono text-foreground text-mono-sm">
              512 MB (Large Heap)
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/40 bg-surface-raised/30 px-3 py-2 text-caption">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>GPU VRAM Texture Budget</span>
            </div>
            <span className="font-medium font-mono text-foreground text-mono-sm">
              1024 MB (Host Unified)
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/40 bg-surface-raised/30 px-3 py-2 text-caption">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>SMP Multithreading</span>
            </div>
            <span className="font-medium font-mono text-foreground text-mono-sm">
              Enabled · 4 Threads
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
