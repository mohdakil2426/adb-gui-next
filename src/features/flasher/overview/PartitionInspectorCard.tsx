import { Info } from 'lucide-react';
import { PARTITION_METADATA } from '@/features/flasher/model/flasherConstants';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface PartitionInspectorCardProps {
  onSelectPartition: (name: string) => void;
  selectedPartition: string;
}

const QUICK_PARTITIONS = [
  'boot',
  'init_boot',
  'vendor_boot',
  'vbmeta',
  'recovery',
  'dtbo',
  'super',
  'system',
  'vendor',
  'userdata',
];

export function PartitionInspectorCard({
  onSelectPartition,
  selectedPartition,
}: PartitionInspectorCardProps) {
  const meta = PARTITION_METADATA[selectedPartition] ?? {
    category: 'kernel',
    description: 'Android flashable partition image.',
    isSlotted: true,
    name: selectedPartition,
    riskLevel: 'standard',
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/50 border-b pb-2">
        <div className="flex items-center gap-2">
          <Badge className="font-mono text-[11px]" variant="secondary">
            {meta.name}.img
          </Badge>
          <Badge
            className="text-[10px]"
            variant={
              meta.riskLevel === 'critical'
                ? 'destructive'
                : meta.riskLevel === 'elevated'
                  ? 'default'
                  : 'outline'
            }
          >
            {meta.riskLevel.toUpperCase()} RISK
          </Badge>
          {meta.isSlotted ? (
            <Badge className="text-[10px]" variant="outline">
              A/B Slotted
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {QUICK_PARTITIONS.map((name) => (
            <Button
              className="h-5 px-1.5 font-mono text-[10px]"
              key={name}
              onClick={() => onSelectPartition(name)}
              size="sm"
              type="button"
              variant={selectedPartition === name ? 'default' : 'ghost'}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-body text-foreground">{meta.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
            <span>
              Category: <strong className="text-foreground capitalize">{meta.category}</strong>
            </span>
            <span>
              Flash Mode:{' '}
              <strong className="text-foreground">
                {meta.category === 'dynamic' ? 'FastbootD (Userspace)' : 'Fastboot (Bootloader)'}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
