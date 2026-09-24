import { Info } from "lucide-react";

import { PARTITION_METADATA } from "@/features/flasher/model/flasher-constants";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

interface PartitionInspectorCardProps {
  onSelectPartition: (name: string) => void;
  selectedPartition: string;
}

const QUICK_PARTITIONS = [
  "boot",
  "init_boot",
  "vendor_boot",
  "vbmeta",
  "recovery",
  "dtbo",
  "super",
  "system",
  "vendor",
  "userdata",
];

const RISK_BADGE_VARIANT: Record<string, "destructive" | "default" | "outline"> = {
  critical: "destructive",
  elevated: "default",
};

export const PartitionInspectorCard = ({
  onSelectPartition,
  selectedPartition,
}: PartitionInspectorCardProps) => {
  const meta = PARTITION_METADATA[selectedPartition] ?? {
    category: "kernel",
    description: "Android flashable partition image.",
    isSlotted: true,
    name: selectedPartition,
    riskLevel: "standard",
  };

  return (
    <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-3 rounded-lg border p-3.5">
      <div className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <Badge className="text-caption font-mono" variant="secondary">
            {meta.name}.img
          </Badge>
          <Badge className="text-caption" variant={RISK_BADGE_VARIANT[meta.riskLevel] ?? "outline"}>
            {meta.riskLevel.toUpperCase()} RISK
          </Badge>
          {meta.isSlotted ? (
            <Badge className="text-caption" variant="outline">
              A/B Slotted
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {QUICK_PARTITIONS.map((name) => (
            <Button
              className="text-caption h-5 px-1.5 font-mono"
              key={name}
              onClick={() => onSelectPartition(name)}
              size="sm"
              type="button"
              variant={selectedPartition === name ? "default" : "ghost"}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-body text-foreground">{meta.description}</p>
          <div className="text-caption text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Category: <strong className="text-foreground capitalize">{meta.category}</strong>
            </span>
            <span>
              Flash Mode:{" "}
              <strong className="text-foreground">
                {meta.category === "dynamic" ? "FastbootD (Userspace)" : "Fastboot (Bootloader)"}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
