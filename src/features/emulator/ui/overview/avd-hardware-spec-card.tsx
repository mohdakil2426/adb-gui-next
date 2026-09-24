import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Camera, Cpu, HardDrive, Maximize2, Monitor, Wifi, Zap } from "lucide-react";

import { EmulatorGetAvdSpecs } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { deriveAvdHardwareDetails } from "@/features/emulator/model/avd-specs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// Empty state handled across UI when data?.length === 0

interface AvdHardwareSpecCardProps {
  avd: backend.AvdSummary | null;
}

const SpecRow = ({
  icon: Icon,
  label,
  value,
  secondary,
}: {
  icon: LucideIcon;
  label: string;
  secondary?: string;
  value: string;
}) => (
  <div className="border-border/40 bg-surface-raised/30 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5">
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="text-caption text-muted-foreground font-medium">{label}</span>
        {secondary ? (
          <span className="text-caption text-muted-foreground truncate">{secondary}</span>
        ) : null}
      </div>
    </div>
    <span className="text-body text-foreground truncate font-medium">{value}</span>
  </div>
);

export const AvdHardwareSpecCard = ({ avd }: AvdHardwareSpecCardProps) => {
  const { data: realSpecs } = useQuery({
    enabled: Boolean(avd?.name),
    queryFn: () =>
      avd?.name ? EmulatorGetAvdSpecs(avd.name) : Promise.reject(new Error("No AVD")),
    queryKey: ["emulator", "avdSpecs", avd?.name],
    staleTime: 30_000,
  });

  const fallback = deriveAvdHardwareDetails(avd);
  const specs = realSpecs ?? fallback;

  return (
    <Card className="border-border bg-surface @container flex h-full flex-col justify-between rounded-xl py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <CardTitle
          as="h2"
          className="text-caption text-muted-foreground flex items-center gap-2 font-medium tracking-wider uppercase"
        >
          <Cpu aria-hidden="true" className="text-muted-foreground size-3.5" />
          Emulated Hardware & Host Interface
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-2.5 px-4.5 pt-1">
        <SpecRow
          icon={Monitor}
          label="Graphics Acceleration Engine"
          secondary="ANGLE Direct3D11 / Vulkan Host Passthrough"
          value={specs.graphicsEngine}
        />

        <SpecRow
          icon={Maximize2}
          label="Display Resolution & Density"
          secondary={`Aspect Ratio 20:9 · Density ${specs.densityDpi} dpi`}
          value={`${specs.resolution} (${specs.densityLabel})`}
        />

        <SpecRow
          icon={HardDrive}
          label="External SD Card & Internal Storage"
          secondary="FAT32 Emulated SD Card · Ext4 Userdata"
          value={`${specs.diskSdcardSize} SD Card · ${specs.diskDataSize} Data`}
        />

        <SpecRow
          icon={Wifi}
          label="Network Profile & Latency Model"
          secondary="Virtual NAT Bridge (10.0.2.15/24) · DNS 10.0.2.3"
          value={specs.networkProfile}
        />

        <SpecRow
          icon={Zap}
          label="Host Virtualization Accelerator"
          secondary="Hardware Nested Virtualization (VT-x / AMD-V)"
          value={specs.hypervisor}
        />

        <SpecRow
          icon={Camera}
          label="Peripherals & Sensor Emulation"
          secondary="Multi-touch · Accelerometer · Gyroscope · GPS Geo"
          value={specs.cameraInfo}
        />
      </CardContent>
    </Card>
  );
};
