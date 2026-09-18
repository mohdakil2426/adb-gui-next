import type { backend } from "@/desktop/models";
import { AvdHardwareSpecCard } from "@/features/emulator/ui/overview/avd-hardware-spec-card";
import { AvdResourceAllocationMeter } from "@/features/emulator/ui/overview/avd-resource-allocation-meter";
import { DiskUsageBreakdownChart } from "@/features/emulator/ui/overview/disk-usage-breakdown-chart";
import { EmulatorKnowledgeBase } from "@/features/emulator/ui/overview/emulator-knowledge-base";

interface EmulatorOverviewTabProps {
  avd: backend.AvdSummary | null;
}

export const EmulatorOverviewTab = ({ avd }: EmulatorOverviewTabProps) => {
  if (!avd) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised/40 p-8 text-center">
        <p className="text-body text-muted-foreground">
          Select an AVD from the switcher above to inspect its virtual hardware and telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Row: Dual Hand-rolled SVG Hardware Telemetry Meters */}
      <div className="grid @2xl:grid-cols-2 grid-cols-1 items-stretch gap-4">
        <AvdResourceAllocationMeter avd={avd} />
        <DiskUsageBreakdownChart avd={avd} />
      </div>

      {/* Middle Row: Hardware Specifications Diagnostic Card */}
      <AvdHardwareSpecCard avd={avd} />

      {/* Bottom Row: Emulator & Rooting Knowledge Base */}
      <EmulatorKnowledgeBase />
    </div>
  );
};
