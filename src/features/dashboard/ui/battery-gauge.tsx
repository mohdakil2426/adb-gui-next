import { m, useReducedMotion } from "framer-motion";

import { TONE_TEXT } from "@/features/dashboard/model/tone";
import type { Tone } from "@/features/dashboard/model/tone";
import { Gauge } from "@/shared/charts/gauge";
import { cn } from "@/shared/utils/cn";

interface BatteryGaugeProps {
  isCharging: boolean;
  levelPct: number | null;
  tone: Tone;
}

const TONE_CSS_COLOR: Record<Tone, string> = {
  danger: "var(--destructive)",
  neutral: "var(--chart-1)",
  ok: "var(--success)",
  warn: "var(--warning)",
};

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

const ChargingAura = ({
  shouldReduceMotion,
  tone,
}: {
  shouldReduceMotion: boolean | null;
  tone: Tone;
}) => (
  <m.div
    animate={
      shouldReduceMotion
        ? { opacity: 0.1, scale: 1 }
        : { opacity: [0.08, 0.18, 0.08], scale: [1, 1.12, 1] }
    }
    aria-hidden="true"
    className={cn(
      "absolute inset-0 rounded-full border border-current opacity-10",
      TONE_TEXT[tone]
    )}
    transition={
      shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 2.2,
            ease: EASE_STANDARD,
            repeat: Number.POSITIVE_INFINITY,
          }
    }
  />
);

/** Radial notch gauge powered by Bklit Gauge with charging aura. */
export const BatteryGauge = ({ isCharging, levelPct, tone }: BatteryGaugeProps) => {
  const shouldReduceMotion = useReducedMotion();
  let statusLabel = "Battery";
  if (levelPct === null) {
    statusLabel = "Unavailable";
  } else if (isCharging) {
    statusLabel = "Charging";
  }

  return (
    <div className="relative flex size-[184px] shrink-0 items-center justify-center">
      {isCharging ? <ChargingAura shouldReduceMotion={shouldReduceMotion} tone={tone} /> : null}
      <Gauge
        activeFill={TONE_CSS_COLOR[tone]}
        centerValue={levelPct ?? 0}
        defaultLabel={statusLabel}
        height={184}
        orientation="arc"
        suffix="%"
        totalNotches={36}
        value={levelPct ?? 0}
        width={184}
      />
    </div>
  );
};
