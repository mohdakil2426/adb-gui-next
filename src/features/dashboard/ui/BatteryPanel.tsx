import { BatteryMedium, HeartHandshake, Zap } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { batteryTone } from '@/features/dashboard/model/tone';
import { BatteryGauge } from '@/features/dashboard/ui/BatteryGauge';
import { MicroScale } from '@/features/dashboard/ui/MicroScale';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { SpecChip } from '@/features/dashboard/ui/SpecChip';
import { Skeleton } from '@/shared/ui/skeleton';
import { EMPTY_VALUE, formatNumber } from '@/shared/utils/format';

interface BatteryPanelProps {
  battery: backend.BatteryInfo | null;
  isLoading: boolean;
}

/** Phone Li-ion comfort band; past ~45 °C is thermally dangerous. */
const TEMP_MIN = -10;
const TEMP_ZONES = [
  { to: 40, tone: 'ok' as const },
  { to: 48, tone: 'warn' as const },
  { to: 60, tone: 'danger' as const },
];

/** Nominal single-cell range; low end sags under load, high end is full. */
const VOLTAGE_MIN = 3200;
const VOLTAGE_MAX = 4400;
const VOLTAGE_ZONES = [
  { to: 3400, tone: 'warn' as const },
  { to: 4200, tone: 'ok' as const },
  { to: 4400, tone: 'warn' as const },
];

export function BatteryPanel({ battery, isLoading }: BatteryPanelProps) {
  const tone = batteryTone(battery?.levelPct ?? null, battery?.isCharging ?? false);
  const temp = battery?.temperatureC ?? null;
  const voltage = battery?.voltageMv ?? null;

  return (
    <PanelCard delay={0.12} icon={BatteryMedium} title="Battery">
      {isLoading && !battery ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <Skeleton className="size-32 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col justify-between gap-3">
          <div className="flex items-center justify-center py-0.5">
            <BatteryGauge
              isCharging={battery?.isCharging ?? false}
              levelPct={battery?.levelPct ?? null}
              tone={tone}
            />
          </div>

          {/* Electrical & thermal instrument scales */}
          <div className="flex flex-col gap-2.5 border-border/50 border-t pt-2.5">
            <MicroScale
              ariaLabel="Battery temperature"
              display={
                temp == null ? EMPTY_VALUE : `${formatNumber(temp, { fractionDigits: 1 })} °C`
              }
              label="Temperature"
              max={TEMP_ZONES[TEMP_ZONES.length - 1]?.to ?? 60}
              min={TEMP_MIN}
              value={temp}
              zones={TEMP_ZONES}
            />
            <MicroScale
              ariaLabel="Battery voltage"
              display={voltage == null ? EMPTY_VALUE : `${formatNumber(voltage)} mV`}
              label="Voltage"
              max={VOLTAGE_MAX}
              min={VOLTAGE_MIN}
              value={voltage}
              zones={VOLTAGE_ZONES}
            />
          </div>

          <div className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2">
            <SpecChip icon={Zap} label="Status" value={battery?.status ?? EMPTY_VALUE} />
            <SpecChip icon={HeartHandshake} label="Health" value={battery?.health ?? EMPTY_VALUE} />
          </div>
        </div>
      )}
    </PanelCard>
  );
}
