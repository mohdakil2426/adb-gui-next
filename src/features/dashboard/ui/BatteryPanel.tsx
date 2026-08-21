import { BatteryMedium, Gauge, HeartHandshake, Thermometer, Zap } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { batteryTone } from '@/features/dashboard/model/tone';
import { BatteryGauge } from '@/features/dashboard/ui/BatteryGauge';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { Skeleton } from '@/shared/ui/skeleton';
import { EMPTY_VALUE, formatNumber } from '@/shared/utils/format';

interface BatteryPanelProps {
  battery: backend.BatteryInfo | null;
  isLoading: boolean;
}

export function BatteryPanel({ battery, isLoading }: BatteryPanelProps) {
  const tone = batteryTone(battery?.levelPct ?? null, battery?.isCharging ?? false);
  const temp = battery?.temperatureC;

  return (
    <PanelCard icon={BatteryMedium} title="Battery">
      {isLoading && !battery ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <Skeleton className="size-34 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-between gap-3">
          <div className="flex flex-1 items-center justify-center py-0.5">
            <BatteryGauge
              isCharging={battery?.isCharging ?? false}
              levelPct={battery?.levelPct ?? null}
              tone={tone}
            />
          </div>

          {/* Electrical & Thermal Micro-Metrics Grid */}
          <div className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <Thermometer className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Temp
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {temp == null ? EMPTY_VALUE : `${formatNumber(temp, { fractionDigits: 1 })} °C`}
                </span>
              </div>
            </div>

            {/* Voltage Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <Gauge className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Voltage
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {battery?.voltageMv == null
                    ? EMPTY_VALUE
                    : `${formatNumber(battery.voltageMv)} mV`}
                </span>
              </div>
            </div>

            {/* Status Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <Zap className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Status
                </span>
                <span className="truncate font-medium text-[11px] text-foreground">
                  {battery?.status ?? EMPTY_VALUE}
                </span>
              </div>
            </div>

            {/* Health Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <HeartHandshake className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Health
                </span>
                <span className="truncate font-medium text-[11px] text-foreground">
                  {battery?.health ?? EMPTY_VALUE}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PanelCard>
  );
}
