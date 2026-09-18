import {
  ArrowLeftRight,
  Battery,
  BatteryWarning,
  Cpu,
  HardDrive,
  Layers,
  Lock,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Unlock,
  Zap,
} from "lucide-react";

import type { FastbootVitals, FlasherConnectionMode } from "@/features/flasher/model/flasher-types";
import { FlasherSpecBadge } from "@/features/flasher/ui/flasher-spec-badge";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: "medium",
});

interface FlasherCockpitHeroProps {
  isFastbootMode: boolean;
  isProbing: boolean;
  lastUpdated: number | null;
  onRefresh: () => void;
  onSwitchSlot?: (slot: "a" | "b") => void;
  vitals: FastbootVitals;
}

const renderConnectionIcon = (mode: FlasherConnectionMode) => {
  if (mode === "SIDELOAD") {
    return <Package aria-hidden="true" className="size-6 text-info" />;
  }
  if (mode === "FASTBOOTD") {
    return <Zap aria-hidden="true" className="size-6 text-warning" />;
  }
  if (mode === "FASTBOOT") {
    return <HardDrive aria-hidden="true" className="size-6 text-foreground" />;
  }
  return <Smartphone aria-hidden="true" className="size-6 text-muted-foreground" />;
};

const getPulseColorClass = (isFastboot: boolean, mode: FlasherConnectionMode) => {
  if (isFastboot) {
    return "bg-warning";
  }
  if (mode === "SIDELOAD") {
    return "bg-info";
  }
  return "bg-success";
};

const getDeviceTitle = (productBoard: string | null, serial: string | null) => {
  if (productBoard) {
    return `${productBoard.toUpperCase()} Hardware`;
  }
  if (serial) {
    return `Device ${serial}`;
  }
  return "No Flasher Target";
};

const CONNECTION_BADGE_VARIANT: Record<
  string,
  "warning" | "default" | "info" | "secondary" | "outline"
> = {
  ADB: "secondary",
  FASTBOOT: "default",
  FASTBOOTD: "warning",
  SIDELOAD: "info",
};

const FlasherSpecGrid = ({ vitals }: { vitals: FastbootVitals }) => {
  const isUnlocked = vitals.lockState === "UNLOCKED";
  const isBatteryLow = vitals.batteryLevel !== null && vitals.batteryLevel < 30;
  const isDualSlot = vitals.slotCount > 1;

  return (
    <div className="grid @3xl:grid-cols-6 @lg:grid-cols-3 @xs:grid-cols-2 gap-2.5">
      <FlasherSpecBadge
        copyValue={vitals.connectionMode}
        icon={Zap}
        label="Protocol Mode"
        tooltip="Active device communication protocol"
        value={vitals.connectionMode}
        variant={
          vitals.connectionMode === "FASTBOOT" || vitals.connectionMode === "FASTBOOTD"
            ? "warning"
            : "default"
        }
      />
      <FlasherSpecBadge
        copyValue={vitals.lockState}
        icon={isUnlocked ? ShieldCheck : ShieldAlert}
        label="Bootloader Lock"
        tooltip={
          isUnlocked
            ? "Bootloader is UNLOCKED. Custom images can be flashed."
            : "Bootloader is LOCKED. Flash operations will be rejected."
        }
        value={vitals.lockState}
        variant={isUnlocked ? "success" : "destructive"}
      />
      <FlasherSpecBadge
        copyValue={vitals.activeSlot}
        icon={Layers}
        label="Active Slot"
        tooltip="Current active boot partition slot"
        value={vitals.activeSlot ? `Slot _${vitals.activeSlot.toUpperCase()}` : "Single Slot"}
        variant="default"
      />
      <FlasherSpecBadge
        copyValue={vitals.productBoard ?? undefined}
        icon={Cpu}
        label="Product Board"
        tooltip="Target SoC hardware board identifier"
        value={vitals.productBoard ? vitals.productBoard.toUpperCase() : "Unknown Board"}
        variant="default"
      />
      <FlasherSpecBadge
        copyValue={vitals.batteryLevel === null ? undefined : `${vitals.batteryLevel}%`}
        icon={isBatteryLow ? BatteryWarning : Battery}
        label="Battery Level"
        tooltip="Hardware battery voltage/state in fastboot"
        value={vitals.batteryLevel === null ? "Host Powered" : `${vitals.batteryLevel}%`}
        variant={isBatteryLow ? "destructive" : "default"}
      />
      <FlasherSpecBadge
        copyValue={isDualSlot ? `${vitals.slotCount} Slots (A/B)` : "Single Slot"}
        icon={HardDrive}
        label="Slot Architecture"
        tooltip="Device partition slot layout"
        value={isDualSlot ? `Dual A/B (${vitals.slotCount})` : "Single Slot"}
        variant="default"
      />
    </div>
  );
};

export const FlasherCockpitHero = ({
  vitals,
  isProbing,
  lastUpdated,
  onRefresh,
  onSwitchSlot,
  isFastbootMode,
}: FlasherCockpitHeroProps) => {
  const isUnlocked = vitals.lockState === "UNLOCKED";
  const nextSlot = vitals.activeSlot === "a" ? "b" : "a";

  return (
    <Card className="@container rounded-xl border-border bg-surface p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Top Header Row */}
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised p-2 text-foreground shadow-xs">
              {renderConnectionIcon(vitals.connectionMode)}

              {/* Pulse Indicator */}
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span
                  className={cn(
                    "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                    getPulseColorClass(isFastbootMode, vitals.connectionMode)
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex size-3 rounded-full border-2 border-surface",
                    getPulseColorClass(isFastbootMode, vitals.connectionMode)
                  )}
                />
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-semibold text-foreground text-title">
                  {getDeviceTitle(vitals.productBoard, vitals.serial)}
                </h2>

                <Badge
                  className="font-mono text-[10px] uppercase"
                  variant={CONNECTION_BADGE_VARIANT[vitals.connectionMode] ?? "outline"}
                >
                  {vitals.connectionMode}
                </Badge>

                {vitals.lockState === "UNKNOWN" ? null : (
                  <Badge
                    className="gap-1 font-mono text-[10px]"
                    variant={isUnlocked ? "success" : "destructive"}
                  >
                    {isUnlocked ? (
                      <>
                        <Unlock className="size-3" />
                        UNLOCKED
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" />
                        LOCKED
                      </>
                    )}
                  </Badge>
                )}

                {vitals.activeSlot !== "unknown" && vitals.activeSlot !== "single" ? (
                  <Badge className="gap-1 font-mono text-[10px]" variant="outline">
                    <Layers className="size-3" />
                    SLOT _{vitals.activeSlot.toUpperCase()}
                  </Badge>
                ) : null}
              </div>

              <p className="truncate text-caption text-muted-foreground">
                {vitals.serial
                  ? `Hardware Serial: ${vitals.serial} · ${
                      vitals.bootloaderVersion
                        ? `Bootloader: ${vitals.bootloaderVersion}`
                        : "Fastboot Protocol v0.5"
                    }`
                  : "Connect an Android device in fastboot, fastbootd, or sideload recovery mode."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 @lg:self-auto self-start">
            {isFastbootMode &&
            (vitals.activeSlot === "a" || vitals.activeSlot === "b") &&
            onSwitchSlot ? (
              <Button
                className="h-8 gap-1.5 px-3 text-caption"
                disabled={isProbing}
                onClick={() => onSwitchSlot(nextSlot)}
                size="sm"
                type="button"
                variant="outline"
              >
                <ArrowLeftRight className="size-3.5" data-icon="inline-start" />
                Switch to Slot _{nextSlot.toUpperCase()}
              </Button>
            ) : null}

            {lastUpdated ? (
              <span className="numeric text-[11px] text-caption text-muted-foreground">
                Probed {updatedAtFormatter.format(lastUpdated)}
              </span>
            ) : null}

            <Button
              aria-label="Refresh hardware vitals"
              className="size-8 rounded-lg p-0"
              disabled={isProbing || !vitals.serial}
              onClick={onRefresh}
              size="sm"
              title="Refresh Fastboot Vitals"
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  "size-3.5 text-muted-foreground",
                  isProbing && "animate-spin text-foreground"
                )}
                data-icon="inline-start"
              />
            </Button>
          </div>
        </div>

        {/* 6-Spec Precision Hardware Grid */}
        <FlasherSpecGrid vitals={vitals} />
      </CardContent>
    </Card>
  );
};
