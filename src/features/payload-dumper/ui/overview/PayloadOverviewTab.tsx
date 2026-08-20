import { Loader2, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UnpackSuperImage } from '@/desktop/backend';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import type { PayloadTabType } from '@/features/payload-dumper/PayloadDumperView';
import { PayloadOverviewCapabilities } from '@/features/payload-dumper/ui/overview/PayloadOverviewCapabilities';
import { PayloadOverviewShortcuts } from '@/features/payload-dumper/ui/overview/PayloadOverviewShortcuts';
import { PayloadStreamDiagnostics } from '@/features/payload-dumper/ui/overview/PayloadStreamDiagnostics';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes } from '@/shared/utils/format';

interface PayloadOverviewTabProps {
  onNavigateTab: (tab: PayloadTabType) => void;
}

export function PayloadOverviewTab({ onNavigateTab }: PayloadOverviewTabProps) {
  const partitions = usePayloadDumperStore((state) => state.partitions);
  const extractedFiles = usePayloadDumperStore((state) => state.extractedFiles);
  const outputDir = usePayloadDumperStore((state) => state.outputDir);
  const outputPath = usePayloadDumperStore((state) => state.outputPath);
  const payloadPath = usePayloadDumperStore((state) => state.payloadPath);
  const status = usePayloadDumperStore((state) => state.status);

  const [isUnpackingSuper, setIsUnpackingSuper] = useState(false);

  const hasSuperPartition = partitions.some(
    (p) => p.name.toLowerCase() === 'super' || p.name.toLowerCase() === 'super.img',
  );
  const hasSuperExtracted = extractedFiles.some(
    (f) => f.toLowerCase().endsWith('super.img') || f.toLowerCase() === 'super.img',
  );
  const hasSuperPayload =
    Boolean(payloadPath) &&
    (payloadPath.toLowerCase().endsWith('super.img') ||
      payloadPath.toLowerCase().endsWith('super'));
  const hasSuper = hasSuperPartition || hasSuperExtracted || hasSuperPayload;

  const handleUnpackSuper = async () => {
    setIsUnpackingSuper(true);
    try {
      const effectiveOutput = outputDir || outputPath;
      const superFromFile = extractedFiles.find(
        (f) => f.toLowerCase().endsWith('super.img') || f.toLowerCase() === 'super.img',
      );
      let superPath = '';
      if (superFromFile && (superFromFile.includes('/') || superFromFile.includes('\\'))) {
        superPath = superFromFile;
      } else if (effectiveOutput) {
        const sep = effectiveOutput.includes('\\') ? '\\' : '/';
        superPath = `${effectiveOutput}${sep}super.img`;
      } else if (hasSuperPayload) {
        superPath = payloadPath;
      }

      const outDir = effectiveOutput || (superPath ? superPath.replace(/[/\\][^/\\]+$/, '') : '');

      if (!(superPath && outDir)) {
        toast.error(
          'Unable to locate super.img path or output directory. Extract super.img first.',
        );
        return;
      }

      toast.info('Unpacking dynamic sub-partitions from super.img...');
      const subPartitions = await UnpackSuperImage(superPath, outDir);

      if (subPartitions.length > 0) {
        const names = subPartitions
          .map(([name, size]) => `${name}.img (${formatBytes(size)})`)
          .join(', ');
        toast.success(
          `Successfully unpacked ${subPartitions.length} dynamic sub-partitions: ${names}`,
        );
      } else {
        toast.warning('No logical sub-partitions found in super.img');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to unpack super.img: ${errorMsg}`);
    } finally {
      setIsUnpackingSuper(false);
    }
  };

  return (
    <div className="@container flex flex-col gap-5">
      {/* Dynamic Partition Unpack Banner (Appears when super.img detected) */}
      {hasSuper ? (
        <Card className="rounded-xl border-primary/30 bg-primary/5 p-4 shadow-none">
          <CardContent className="flex @sm:flex-row flex-col @sm:items-center @sm:justify-between gap-3 p-0">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                <PackageOpen className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-body text-foreground">
                    Dynamic Partition Container (super.img) Detected
                  </h3>
                  <Badge className="border-primary/30 bg-primary/10 text-primary" variant="outline">
                    LpMetadata Ready
                  </Badge>
                </div>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Unpack logical sub-partitions (<code className="text-[11px]">system.img</code>,{' '}
                  <code className="text-[11px]">vendor.img</code>,{' '}
                  <code className="text-[11px]">product.img</code>,{' '}
                  <code className="text-[11px]">system_ext.img</code>,{' '}
                  <code className="text-[11px]">odm.img</code>) directly from the super image.
                </p>
              </div>
            </div>
            <Button
              className="shrink-0 self-start @sm:self-center"
              disabled={isUnpackingSuper || status === 'extracting'}
              onClick={handleUnpackSuper}
            >
              {isUnpackingSuper ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" data-icon="inline-start" />
                  Unpacking Sub-Partitions...
                </>
              ) : (
                <>
                  <PackageOpen className="mr-1.5 size-4" data-icon="inline-start" />
                  Unpack super.img Sub-Partitions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {/* Section 1: Core Navigation Shortcuts */}
      <PayloadOverviewShortcuts onNavigateTab={onNavigateTab} />

      {/* Section 2 & 3: Engine Capabilities & 3-Step Guide */}
      <PayloadOverviewCapabilities />

      {/* Section 4: Stream Engine Mechanics */}
      <PayloadStreamDiagnostics />
    </div>
  );
}
