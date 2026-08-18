import { Layers, Terminal } from 'lucide-react';
import { useState } from 'react';
import type { ActiveSlot } from '@/features/flasher/model/flasherTypes';
import { PartitionHierarchySvg } from '@/features/flasher/overview/PartitionHierarchySvg';
import { PartitionInspectorCard } from '@/features/flasher/overview/PartitionInspectorCard';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface PartitionHierarchyDiagramProps {
  activeSlot: ActiveSlot;
}

const ASCII_DIAGRAM = `[Primary Boot ROM / SoC Microcode]
            │
            ▼
[Primary Bootloader (XBL / ABOOT)]
            │
    ┌───────┴───────┐
    ▼               ▼
┌──────────────┐ ┌──────────────┐
│    SLOT A    │ │    SLOT B    │
│ (Active/Alt) │ │ (Active/Alt) │
└───────┬──────┘ └──────┬───────┘
        │               │
        ├───────────────────────────────┐
        ▼                               ▼
[Core Kernel & AVB Security]    [AVB 2.0 Chained Hashes]
├── boot.img (Kernel + Init)    ├── vbmeta.img
├── init_boot.img (GKI Ramdisk) ├── vbmeta_system.img
├── vendor_boot.img (Modules)   └── vbmeta_vendor.img
└── dtbo.img (Device Tree Blob)
        │
        ▼
[Dynamic Partition Container: super.img]
├── system.img (Android Framework & ART)
├── vendor.img (Hardware HALs & Drivers)
├── product.img (OEM Software & Apps)
├── system_ext.img (Extended Framework)
└── odm.img (Original Design Manufacturer)
        │
        ▼
[Encrypted User Storage: userdata]
└── FBE Encrypted User Apps, Files, Keystore (/data)`;

export function PartitionHierarchyDiagram({ activeSlot }: PartitionHierarchyDiagramProps) {
  const [selectedPartition, setSelectedPartition] = useState<string>('boot');
  const [viewMode, setViewMode] = useState<'diagram' | 'ascii'>('diagram');

  return (
    <Card className="flex h-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Layers className="size-5 text-muted-foreground" />
            Android A/B Partition Architecture
          </CardTitle>
          <CardDescription className="text-caption">
            Structural hierarchy of bootloader, dual slots, kernel images, and dynamic super
            container.
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            className={cn(
              'h-7 gap-1 px-2.5 text-caption',
              viewMode === 'diagram' && 'bg-surface-raised',
            )}
            onClick={() => setViewMode('diagram')}
            size="sm"
            type="button"
            variant="outline"
          >
            <Layers className="size-3" />
            Visual
          </Button>
          <Button
            className={cn(
              'h-7 gap-1 px-2.5 text-caption',
              viewMode === 'ascii' && 'bg-surface-raised',
            )}
            onClick={() => setViewMode('ascii')}
            size="sm"
            type="button"
            variant="outline"
          >
            <Terminal className="size-3" />
            ASCII
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {viewMode === 'ascii' ? (
          <div className="flex-1 overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3.5">
            <pre className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {ASCII_DIAGRAM}
            </pre>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <PartitionHierarchySvg
              activeSlot={activeSlot}
              onSelectPartition={setSelectedPartition}
              selectedPartition={selectedPartition}
            />
            <PartitionInspectorCard
              onSelectPartition={setSelectedPartition}
              selectedPartition={selectedPartition}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
