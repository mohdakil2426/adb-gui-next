import { ArrowRight, Cpu, Layers, Smartphone } from "lucide-react";

import { BRAND_DISPLAY_INFO } from "@/features/payload-dumper/ui/marketplace/types";
import type { FirmwareDeviceModel } from "@/features/payload-dumper/ui/marketplace/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";

export interface FirmwareDeviceCardProps {
  device: FirmwareDeviceModel;
  onSelect: (device: FirmwareDeviceModel) => void;
}

export const FirmwareDeviceCard = ({ device, onSelect }: FirmwareDeviceCardProps) => {
  const brandInfo = BRAND_DISPLAY_INFO[device.brand] ?? {
    displayName: device.brand,
    shortLabel: device.brand,
  };

  const otaBuildsCount = device.builds.filter((b) => b.imageType === "ota").length;
  const factoryBuildsCount = device.builds.filter((b) => b.imageType === "factory").length;
  const latestBuild = device.builds.find((b) => b.isLatest) ?? device.builds[0] ?? null;

  return (
    <Card
      className="group border-border bg-surface hover:border-primary/50 hover:bg-surface-raised/40 relative cursor-pointer rounded-xl transition-[border-color,background-color,box-shadow] duration-150 hover:shadow-sm"
      onClick={() => onSelect(device)}
    >
      <CardContent className="flex h-full flex-col justify-between p-4.5">
        <div className="flex flex-col gap-3">
          {/* Header row: Device Icon & Codename */}
          <div className="flex items-center justify-between">
            <div className="border-border bg-surface-raised text-primary group-hover:border-primary/40 group-hover:bg-primary/10 flex size-9 items-center justify-center rounded-lg border transition-colors">
              <Smartphone className="size-4.5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
                {device.codename}
              </span>
              <Badge variant="outline">{brandInfo.displayName}</Badge>
              {device.series ? <Badge variant="secondary">{device.series}</Badge> : null}
            </div>
          </div>

          {/* Title & SoC */}
          <div>
            <h3 className="text-body text-foreground group-hover:text-primary font-semibold transition-colors">
              {device.name}
            </h3>
            <div className="text-caption text-muted-foreground mt-1 flex items-center gap-1.5">
              {device.soc ? (
                <>
                  <Cpu className="text-muted-foreground/70 size-3.5 shrink-0" />
                  <span className="truncate">{device.soc}</span>
                  {device.releaseYear ? <span>·</span> : null}
                </>
              ) : null}
              {device.releaseYear ? <span>{device.releaseYear}</span> : null}
            </div>
          </div>

          {/* Latest OS indicator */}
          {latestBuild ? (
            <div className="border-border/60 bg-surface-raised/40 text-caption rounded-md border px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px]">Latest Firmware</span>
                <span className="text-foreground truncate font-mono text-[11px]">
                  {latestBuild.version || latestBuild.buildId}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-border/60 bg-surface-raised/40 text-caption rounded-md border px-2.5 py-1.5">
              <span className="text-muted-foreground text-[11px]">Catalog Entry</span>
            </div>
          )}
        </div>

        {/* Footer: Builds Count & Action */}
        <div className="border-border/40 text-caption mt-4 flex items-center justify-between border-t pt-3">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Layers className="text-primary/80 size-3.5" />
            <span>
              {otaBuildsCount} {device.brand === "xiaomi" ? "Recovery" : "OTA"} ·{" "}
              {factoryBuildsCount} {device.brand === "xiaomi" ? "Fastboot" : "Factory"}
            </span>
          </div>
          <div className="text-primary flex items-center gap-1 font-medium">
            <span>View Builds</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
