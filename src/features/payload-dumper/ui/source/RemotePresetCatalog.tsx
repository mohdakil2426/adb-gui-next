import { ArrowUpRight, Check, Globe } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

interface RemotePreset {
  badge: string;
  brand: string;
  description: string;
  docsUrl?: string;
  format: string;
  id: string;
  sampleUrl: string;
  title: string;
}

const REMOTE_PRESETS: RemotePreset[] = [
  {
    badge: 'Full OTA Zip',
    brand: 'Google Pixel',
    description: 'Official Android 14/15 Full OTA Update containing payload.bin',
    format: 'Standard A/B payload.bin in Zip',
    id: 'pixel-ota',
    sampleUrl:
      'https://dl.google.com/developers/android/vic/images/ota/husky_beta-ota-ap31.240617.015-fa6e6e2f.zip',
    title: 'Google Pixel 8 Pro OTA',
  },
  {
    badge: 'Direct Payload',
    brand: 'LineageOS',
    description: 'Official nightly A/B custom ROM build with pure payload.bin',
    format: 'payload.bin in Zip',
    id: 'lineage-ota',
    sampleUrl:
      'https://mirrorbits.lineageos.org/full/cheetah/20240720/lineage-21.0-20240720-nightly-cheetah-signed.zip',
    title: 'LineageOS 21 (Pixel 7 Pro)',
  },
  {
    badge: 'OxygenOS OTA',
    brand: 'OnePlus',
    description: 'Official OnePlus OxygenOS / ColorOS OTA firmware zip archive',
    format: 'payload.bin / ops archive',
    id: 'oneplus-ota',
    sampleUrl:
      'https://oxygenos.oneplus.net/OnePlus11Oxygen_14.E.21_OTA_0210_all_2401121852_b71887e174b0.zip',
    title: 'OnePlus 11 OxygenOS 14',
  },
  {
    badge: 'NothingOS OTA',
    brand: 'Nothing Phone',
    description: 'Nothing OS official full incremental/full OTA delivery package',
    format: 'Standard payload.bin',
    id: 'nothing-ota',
    sampleUrl:
      'https://android.googleapis.com/packages/ota-api/package/5938f32840003b57223e74a810693a1cfa28cb52.zip',
    title: 'Nothing Phone (2) NOS 2.5',
  },
  {
    badge: 'HyperOS Recovery',
    brand: 'Xiaomi / POCO',
    description: 'Xiaomi HyperOS / MIUI Full Recovery ROM with payload.bin',
    format: 'Standard A/B payload.bin',
    id: 'xiaomi-ota',
    sampleUrl:
      'https://bigota.d.miui.com/OS1.0.8.0.UMBMIXM/miui_SHENNONGSGlobal_OS1.0.8.0.UMBMIXM_88031d27ae_14.0.zip',
    title: 'Xiaomi 14 HyperOS Global',
  },
  {
    badge: 'Motorola Firmware',
    brand: 'Motorola',
    description: 'Motorola Edge / Moto G official rescue OTA update archive',
    format: 'Sparse images / payload.bin',
    id: 'motorola-ota',
    sampleUrl: 'https://motorola-global-portal.custhelp.com/eula/firmware/moto_edge_40_ota.zip',
    title: 'Motorola Edge 40 Pro',
  },
];

interface RemotePresetCatalogProps {
  onSelectUrl: (url: string) => void;
}

export function RemotePresetCatalog({ onSelectUrl }: RemotePresetCatalogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleApply = (preset: RemotePreset) => {
    setSelectedId(preset.id);
    onSelectUrl(preset.sampleUrl);
    toast.info(`Loaded ${preset.title} URL into remote address bar`);
  };

  return (
    <Card className="flex flex-col rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground text-title">
            <Globe className="size-4 text-primary" /> OTA Firmware URL Presets
          </h3>
          <p className="text-caption text-muted-foreground">
            Direct streaming URL templates for Google Pixel, OnePlus, Xiaomi, Nothing & LineageOS
          </p>
        </div>
        <Badge className="text-caption" variant="outline">
          {REMOTE_PRESETS.length} OEM Presets
        </Badge>
      </div>

      <CardContent className="grid @lg:grid-cols-3 @sm:grid-cols-2 grid-cols-1 gap-3 p-0 pt-2">
        {REMOTE_PRESETS.map((preset) => {
          const isSelected = selectedId === preset.id;

          return (
            <div
              className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 bg-surface-raised/40 p-3 transition-colors hover:bg-surface-raised/80"
              key={preset.id}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="truncate font-semibold text-body text-foreground">
                    {preset.title}
                  </span>
                  <Badge className="text-[10px]" variant="secondary">
                    {preset.brand}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-caption text-muted-foreground">
                  {preset.description}
                </p>
              </div>

              <div className="flex flex-col gap-2 border-border/40 border-t pt-2">
                <span
                  className="truncate font-mono text-[10px] text-muted-foreground"
                  title={preset.sampleUrl}
                >
                  {preset.sampleUrl}
                </span>

                <Button
                  className="h-7 w-full gap-1 text-caption"
                  onClick={() => handleApply(preset)}
                  size="sm"
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                >
                  {isSelected ? (
                    <>
                      <Check className="mr-1 size-3 text-success" /> URL Loaded
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="mr-1 size-3" /> Use This OTA URL
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
