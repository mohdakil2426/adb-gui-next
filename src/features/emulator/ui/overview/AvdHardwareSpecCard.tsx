import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Camera, Cpu, HardDrive, Maximize2, Monitor, Wifi, Zap } from 'lucide-react';
import { EmulatorGetAvdSpecs } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { deriveAvdHardwareDetails } from '@/features/emulator/model/avdSpecs';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface AvdHardwareSpecCardProps {
  avd: backend.AvdSummary | null;
}

function SpecRow({
  icon: Icon,
  label,
  value,
  secondary,
}: {
  icon: LucideIcon;
  label: string;
  secondary?: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface-raised/30 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-caption text-muted-foreground">{label}</span>
          {secondary ? (
            <span className="truncate text-[11px] text-muted-foreground">{secondary}</span>
          ) : null}
        </div>
      </div>
      <span className="truncate font-medium text-body text-foreground">{value}</span>
    </div>
  );
}

export function AvdHardwareSpecCard({ avd }: AvdHardwareSpecCardProps) {
  const { data: realSpecs } = useQuery({
    queryKey: ['emulator', 'avdSpecs', avd?.name],
    queryFn: () => (avd?.name ? EmulatorGetAvdSpecs(avd.name) : Promise.reject('No AVD')),
    enabled: Boolean(avd?.name),
    staleTime: 30_000,
  });

  const fallback = deriveAvdHardwareDetails(avd);
  const specs = realSpecs ?? fallback;

  return (
    <Card className="@container flex h-full flex-col justify-between rounded-xl border-border bg-surface py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <CardTitle
          as="h2"
          className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
        >
          <Cpu aria-hidden="true" className="size-3.5 text-muted-foreground" />
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
}
