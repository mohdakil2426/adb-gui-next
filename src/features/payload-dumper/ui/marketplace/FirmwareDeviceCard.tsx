import { ArrowRight, Cpu, Layers, Smartphone } from 'lucide-react';
import {
  BRAND_DISPLAY_INFO,
  type FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';

export interface FirmwareDeviceCardProps {
  device: FirmwareDeviceModel;
  onSelect: (device: FirmwareDeviceModel) => void;
}

export function FirmwareDeviceCard({ device, onSelect }: FirmwareDeviceCardProps) {
  const brandInfo = BRAND_DISPLAY_INFO[device.brand] ?? {
    displayName: device.brand,
    shortLabel: device.brand,
  };

  const otaBuildsCount = device.builds.filter((b) => b.imageType === 'ota').length;
  const factoryBuildsCount = device.builds.filter((b) => b.imageType === 'factory').length;
  const latestBuild = device.builds.find((b) => b.isLatest) ?? device.builds[0] ?? null;

  return (
    <Card
      className="group relative cursor-pointer rounded-xl border-border bg-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
      onClick={() => onSelect(device)}
    >
      <CardContent className="flex h-full flex-col justify-between p-4.5">
        <div className="flex flex-col gap-3">
          {/* Header row: Device Icon & Codename */}
          <div className="flex items-center justify-between">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
              <Smartphone className="size-4.5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                {device.codename}
              </span>
              <Badge variant="outline">{brandInfo.displayName}</Badge>
              {device.series ? <Badge variant="secondary">{device.series}</Badge> : null}
            </div>
          </div>

          {/* Title & SoC */}
          <div>
            <h3 className="font-semibold text-body text-foreground transition-colors group-hover:text-primary">
              {device.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
              {device.soc ? (
                <>
                  <Cpu className="size-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{device.soc}</span>
                  {device.releaseYear ? <span>·</span> : null}
                </>
              ) : null}
              {device.releaseYear ? <span>{device.releaseYear}</span> : null}
            </div>
          </div>

          {/* Latest OS indicator */}
          {latestBuild ? (
            <div className="rounded-md border border-border/60 bg-surface-raised/40 px-2.5 py-1.5 text-caption">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Latest Firmware</span>
                <span className="truncate font-mono text-[11px] text-foreground">
                  {latestBuild.version || latestBuild.buildId}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border/60 bg-surface-raised/40 px-2.5 py-1.5 text-caption">
              <span className="text-[11px] text-muted-foreground">Catalog Entry</span>
            </div>
          )}
        </div>

        {/* Footer: Builds Count & Action */}
        <div className="mt-4 flex items-center justify-between border-border/40 border-t pt-3 text-caption">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5 text-primary/80" />
            <span>
              {otaBuildsCount} {device.brand === 'xiaomi' ? 'Recovery' : 'OTA'} ·{' '}
              {factoryBuildsCount} {device.brand === 'xiaomi' ? 'Fastboot' : 'Factory'}
            </span>
          </div>
          <div className="flex items-center gap-1 font-medium text-primary">
            <span>View Builds</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
