import { BatteryMedium } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { batteryTone } from '@/features/dashboard/model/tone';
import { BatteryGauge } from '@/features/dashboard/ui/BatteryGauge';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { StatRow } from '@/features/dashboard/ui/StatRow';
import { Skeleton } from '@/shared/ui/skeleton';
import { EMPTY_VALUE, formatNumber } from '@/shared/utils/format';

interface BatteryPanelProps {
  battery: backend.BatteryInfo | null;
  isLoading: boolean;
}

export function BatteryPanel({ battery, isLoading }: BatteryPanelProps) {
  const tone = batteryTone(battery?.levelPct ?? null, battery?.isCharging ?? false);

  return (
    <PanelCard icon={BatteryMedium} title="Battery">
      {isLoading && !battery ? (
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-33 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <BatteryGauge
            isCharging={battery?.isCharging ?? false}
            levelPct={battery?.levelPct ?? null}
            tone={tone}
          />

          <div className="flex w-full flex-col divide-y divide-border">
            <StatRow label="Status" value={battery?.status ?? EMPTY_VALUE} />
            <StatRow label="Health" value={battery?.health ?? EMPTY_VALUE} />
            <StatRow
              label="Temperature"
              numeric
              value={
                battery?.temperatureC == null
                  ? EMPTY_VALUE
                  : `${formatNumber(battery.temperatureC, { fractionDigits: 1 })} °C`
              }
            />
            <StatRow
              label="Voltage"
              numeric
              value={
                battery?.voltageMv == null ? EMPTY_VALUE : `${formatNumber(battery.voltageMv)} mV`
              }
            />
          </div>
        </div>
      )}
    </PanelCard>
  );
}
