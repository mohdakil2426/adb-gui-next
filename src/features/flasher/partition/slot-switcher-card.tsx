import { ArrowLeftRight, Check, Layers, Loader2, Zap } from "lucide-react";
import { useState } from "react";

import type { ActiveSlot } from "@/features/flasher/model/flasher-types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

interface SlotSwitcherCardProps {
  activeSlot: ActiveSlot;
  disabled?: boolean | undefined;
  isFastbootMode: boolean;
  onRebootFastboot?: (() => void) | undefined;
  onSwitchSlot: (slot: "a" | "b") => void;
  slotCount: number;
}

interface SlotItemCardProps {
  disabled: boolean;
  isCurrent: boolean;
  isFastbootMode: boolean;
  isSwitching: boolean;
  onSwitch: () => void;
  otherSwitching: boolean;
  slotName: "A" | "B";
}

const SlotItemCard = ({
  slotName,
  isCurrent,
  isSwitching,
  otherSwitching,
  disabled,
  isFastbootMode,
  onSwitch,
}: SlotItemCardProps) => (
  <div
    className={cn(
      "flex flex-col gap-2.5 rounded-lg border p-3.5 transition-[border-color,background-color,box-shadow] duration-150",
      isCurrent
        ? "border-success/40 bg-success/5 shadow-xs"
        : "border-border/80 bg-surface-raised/40"
    )}
  >
    <div className="flex items-center justify-between">
      <span className="font-bold font-mono text-body text-foreground">SLOT _{slotName}</span>
      {isCurrent ? (
        <Badge className="gap-1 font-mono text-[10px]" variant="success">
          <Check className="size-3" />
          ACTIVE
        </Badge>
      ) : (
        <Badge className="font-mono text-[10px]" variant="outline">
          INACTIVE
        </Badge>
      )}
    </div>

    <p className="text-[11px] text-muted-foreground">
      {isCurrent
        ? "Currently designated boot target for kernel & system."
        : "Alternative backup partition slot."}
    </p>

    <Button
      className="mt-1 w-full text-caption"
      disabled={disabled || !isFastbootMode || isCurrent || otherSwitching}
      onClick={onSwitch}
      size="sm"
      type="button"
      variant={isCurrent ? "secondary" : "outline"}
    >
      {isSwitching ? (
        <Loader2 className="mr-1.5 size-3 animate-spin" data-icon="inline-start" />
      ) : (
        <ArrowLeftRight className="mr-1.5 size-3" data-icon="inline-start" />
      )}
      {isCurrent ? "Current Slot" : `Set Active Slot ${slotName}`}
    </Button>
  </div>
);

export const SlotSwitcherCard = ({
  activeSlot,
  slotCount,
  onSwitchSlot,
  onRebootFastboot,
  isFastbootMode,
  disabled = false,
}: SlotSwitcherCardProps) => {
  const [switchingSlot, setSwitchingSlot] = useState<"a" | "b" | null>(null);

  const handleSwitch = async (slot: "a" | "b") => {
    setSwitchingSlot(slot);
    try {
      await onSwitchSlot(slot);
    } finally {
      setSwitchingSlot(null);
    }
  };

  const isSlotA = activeSlot === "a";
  const isSlotB = activeSlot === "b";
  const isDualSlot = slotCount > 1 || activeSlot === "a" || activeSlot === "b";

  return (
    <Card className="flex flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Layers className="size-5 text-muted-foreground" />
            Active Boot Slot Switcher
          </CardTitle>
          <Badge variant={isDualSlot ? "outline" : "secondary"}>
            {isDualSlot ? "Dual A/B Slots" : "Single Slot"}
          </Badge>
        </div>
        <CardDescription className="text-caption">
          Change which partition slot the bootloader boots from on the next startup.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5">
        {/* Visual Slot Representation */}
        <div className="grid grid-cols-2 gap-3">
          <SlotItemCard
            disabled={disabled}
            isCurrent={isSlotA}
            isFastbootMode={isFastbootMode}
            isSwitching={switchingSlot === "a"}
            onSwitch={() => {
              void handleSwitch("a");
            }}
            otherSwitching={switchingSlot !== null}
            slotName="A"
          />
          <SlotItemCard
            disabled={disabled}
            isCurrent={isSlotB}
            isFastbootMode={isFastbootMode}
            isSwitching={switchingSlot === "b"}
            onSwitch={() => {
              void handleSwitch("b");
            }}
            otherSwitching={switchingSlot !== null}
            slotName="B"
          />
        </div>

        {/* Action Helper */}
        {onRebootFastboot ? (
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
            <span className="text-caption text-muted-foreground">
              Need FastbootD for dynamic partitions?
            </span>
            <Button
              className="h-7 gap-1 text-caption"
              disabled={disabled || !isFastbootMode}
              onClick={onRebootFastboot}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Zap aria-hidden="true" className="size-3 text-warning" data-icon="inline-start" />
              Reboot FastbootD
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
