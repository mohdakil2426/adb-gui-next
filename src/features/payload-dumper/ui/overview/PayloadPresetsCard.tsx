import { ArrowRight, CheckCircle2, Layers, PackageCheck, Radio, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  EXTRACTION_PRESETS,
  type ExtractionPreset,
} from '@/features/payload-dumper/utils/partitionCategories';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes } from '@/shared/utils/format';

interface PartitionItem {
  name: string;
  selected: boolean;
  size: number;
}

interface PayloadPresetsCardProps {
  onApplyPreset: (matcher: (name: string) => boolean) => void;
  onNavigateToExtractor: () => void;
  partitions: PartitionItem[];
}

export function PayloadPresetsCard({
  partitions,
  onApplyPreset,
  onNavigateToExtractor,
}: PayloadPresetsCardProps) {
  const hasPayload = partitions.length > 0;

  const handleSelectPreset = (preset: ExtractionPreset) => {
    onApplyPreset(preset.matcher);
    const matched = partitions.filter((p) => preset.matcher(p.name));
    const totalMatchedBytes = matched.reduce((sum, p) => sum + p.size, 0);

    toast.success(
      `Applied ${preset.name} preset: ${matched.length} partitions selected (${formatBytes(totalMatchedBytes)})`,
    );
  };

  const getPresetIcon = (id: string) => {
    switch (id) {
      case 'root-kit':
        return Zap;
      case 'system-vendor':
        return Layers;
      case 'modem-radio':
        return Radio;
      case 'full-flash':
        return PackageCheck;
      default:
        return Sparkles;
    }
  };

  return (
    <Card className="flex flex-col justify-between rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground text-title">
            <Sparkles className="size-4 text-warning" /> Quick Extraction Presets
          </h3>
          <p className="text-caption text-muted-foreground">
            Single-click partition selection workflows for common flashing and rooting tasks
          </p>
        </div>
        {hasPayload ? (
          <Button
            className="h-7 gap-1 text-caption"
            onClick={onNavigateToExtractor}
            size="sm"
            type="button"
            variant="ghost"
          >
            Go to Extractor <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <CardContent className="grid @lg:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-3 p-0 pt-2">
        {EXTRACTION_PRESETS.map((preset) => {
          const Icon = getPresetIcon(preset.id);
          const matchedPartitions = hasPayload
            ? partitions.filter((p) => preset.matcher(p.name))
            : [];
          const matchedBytes = matchedPartitions.reduce((sum, p) => sum + p.size, 0);
          const allMatchedSelected =
            matchedPartitions.length > 0 && matchedPartitions.every((p) => p.selected);

          return (
            <div
              className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 bg-surface-raised/40 p-3 transition-colors hover:bg-surface-raised/80"
              key={preset.id}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md border border-border/80 bg-surface text-primary">
                      <Icon className="size-4" />
                    </div>
                    <span className="font-semibold text-body text-foreground">{preset.name}</span>
                  </div>
                  <Badge className="text-[10px]" variant="outline">
                    {preset.badge}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-caption text-muted-foreground">
                  {preset.description}
                </p>
              </div>

              <div className="flex flex-col gap-2 border-border/40 border-t pt-2">
                <div className="flex items-center justify-between text-caption tabular-nums">
                  <span className="text-muted-foreground">
                    {hasPayload ? `${matchedPartitions.length} parts matched` : 'Target schema'}
                  </span>
                  <span className="font-medium text-foreground">
                    {hasPayload ? formatBytes(matchedBytes) : 'Ready'}
                  </span>
                </div>

                <Button
                  className="h-7 w-full text-caption"
                  disabled={!hasPayload}
                  onClick={() => handleSelectPreset(preset)}
                  size="sm"
                  type="button"
                  variant={allMatchedSelected ? 'secondary' : 'outline'}
                >
                  {allMatchedSelected ? (
                    <>
                      <CheckCircle2 className="mr-1 size-3 text-success" /> Selected
                    </>
                  ) : (
                    `Select ${preset.name}`
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
