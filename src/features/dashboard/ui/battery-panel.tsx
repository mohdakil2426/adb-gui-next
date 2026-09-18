import { BatteryMedium, HeartHandshake, Zap } from "lucide-react";

import type { backend } from "@/desktop/models";
import { batteryTone } from "@/features/dashboard/model/tone";
import type { Tone } from "@/features/dashboard/model/tone";
import { BatteryGauge } from "@/features/dashboard/ui/battery-gauge";
import { MicroScale } from "@/features/dashboard/ui/micro-scale";
import { PanelCard } from "@/features/dashboard/ui/panel-card";
import { SpecChip } from "@/features/dashboard/ui/spec-chip";
import { Skeleton } from "@/shared/ui/skeleton";
import { EMPTY_VALUE, formatNumber } from "@/shared/utils/format";

interface BatteryPanelProps {
  battery: backend.BatteryInfo | null;
  isLoading: boolean;
}

/** Phone Li-ion comfort band; past ~45 °C is thermally dangerous. */
const TEMP_MIN = -10;
const TEMP_ZONES = [
  { to: 40, tone: "ok" as const },
  { to: 48, tone: "warn" as const },
  { to: 60, tone: "danger" as const },
];

/** Nominal single-cell range; low end sags under load, high end is full. */
const VOLTAGE_MIN = 3200;
const VOLTAGE_MAX = 4400;
const VOLTAGE_ZONES = [
  { to: 3400, tone: "warn" as const },
  { to: 4200, tone: "ok" as const },
  { to: 4400, tone: "warn" as const },
];
const BatterySkeleton = () => (
  <div className="flex flex-col items-center gap-3 py-2">
    <Skeleton className="size-32 rounded-full" />
    <Skeleton className="h-4 w-40" />
  </div>
);

const BatteryChips = ({ health, status }: { health: string; status: string }) => (
  <div className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2">
    <SpecChip icon={Zap} label="Status" value={status} />
    <SpecChip icon={HeartHandshake} label="Health" value={health} />
  </div>
);

const BatteryScales = ({
  temp,
  tempDisplay,
  voltage,
  voltageDisplay,
}: {
  temp: number | null;
  tempDisplay: string;
  voltage: number | null;
  voltageDisplay: string;
}) => (
  <div className="flex flex-col gap-2.5 border-border/50 border-t pt-2.5">
    <MicroScale
      ariaLabel="Battery temperature"
      display={tempDisplay}
      label="Temperature"
      max={TEMP_ZONES.at(-1)?.to ?? 60}
      min={TEMP_MIN}
      value={temp}
      zones={TEMP_ZONES}
    />
    <MicroScale
      ariaLabel="Battery voltage"
      display={voltageDisplay}
      label="Voltage"
      max={VOLTAGE_MAX}
      min={VOLTAGE_MIN}
      value={voltage}
      zones={VOLTAGE_ZONES}
    />
  </div>
);

const BatteryContent = ({ battery, tone }: { battery: backend.BatteryInfo | null; tone: Tone }) => {
  const isCharging = battery?.isCharging ?? false;
  const levelPct = battery?.levelPct ?? null;
  const temp = battery?.temperatureC ?? null;
  const voltage = battery?.voltageMv ?? null;
  const tempDisplay =
    temp === null ? EMPTY_VALUE : `${formatNumber(temp, { fractionDigits: 1 })} °C`;
  const voltageDisplay = voltage === null ? EMPTY_VALUE : `${formatNumber(voltage)} mV`;

  return (
    <div className="flex w-full flex-1 flex-col justify-between gap-3">
      <div className="flex items-center justify-center py-0.5">
        <BatteryGauge isCharging={isCharging} levelPct={levelPct} tone={tone} />
      </div>

      <BatteryScales
        temp={temp}
        tempDisplay={tempDisplay}
        voltage={voltage}
        voltageDisplay={voltageDisplay}
      />

      <BatteryChips
        health={battery?.health ?? EMPTY_VALUE}
        status={battery?.status ?? EMPTY_VALUE}
      />
    </div>
  );
};

export const BatteryPanel = ({ battery, isLoading }: BatteryPanelProps) => {
  const tone = batteryTone(battery?.levelPct ?? null, battery?.isCharging ?? false);

  return (
    <PanelCard delay={0.12} icon={BatteryMedium} title="Battery">
      {isLoading && !battery ? (
        <BatterySkeleton />
      ) : (
        <BatteryContent battery={battery ?? null} tone={tone} />
      )}
    </PanelCard>
  );
};
