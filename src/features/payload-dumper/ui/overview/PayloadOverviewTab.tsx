import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileCode2,
  History,
  Layers,
  Loader2,
  PackageOpen,
  Radio,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UnpackSuperImage } from '@/desktop/backend';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import type { PayloadTabType } from '@/features/payload-dumper/PayloadDumperView';
import { PayloadStreamDiagnostics } from '@/features/payload-dumper/ui/overview/PayloadStreamDiagnostics';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
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
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Unpacking Sub-Partitions...
                </>
              ) : (
                <>
                  <PackageOpen className="mr-1.5 size-4" />
                  Unpack super.img Sub-Partitions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {/* Section 1: Quick Workflow Shortcuts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground text-title">Workflow Shortcuts</h2>
            <p className="text-caption text-muted-foreground">
              Jump directly to core payload dumper workspaces
            </p>
          </div>
          <Badge variant="outline">
            <Sparkles className="mr-1 size-3 text-primary" />
            Quick Navigation
          </Badge>
        </div>

        <div className="grid @lg:grid-cols-3 @sm:grid-cols-2 grid-cols-1 gap-3.5">
          {/* 1. Google Pixel Firmware Hub */}
          <Card
            className="group relative cursor-pointer rounded-xl border-border bg-surface transition-all duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
            onClick={() => onNavigateTab('marketplace')}
          >
            <CardContent className="flex h-full flex-col justify-between p-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                    <Store className="size-4.5" />
                  </div>
                  <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
                    Catalog
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                    Firmware Hub
                  </h3>
                  <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                    Explore official Google Pixel OTA & Factory builds with 1-click remote stream.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
                <span>Open Catalog</span>
                <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>

          {/* 2. Selective Partition Extractor & Ingestion */}
          <Card
            className="group relative cursor-pointer rounded-xl border-border bg-surface transition-all duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
            onClick={() => onNavigateTab('extractor')}
          >
            <CardContent className="flex h-full flex-col justify-between p-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                    <Layers className="size-4.5" />
                  </div>
                  <Badge variant="secondary">Extractor</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                    Partition Extractor
                  </h3>
                  <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                    Load local files or remote URLs, filter, and extract specific partition images (
                    <code className="text-[11px]">boot</code>,{' '}
                    <code className="text-[11px]">init_boot</code>,{' '}
                    <code className="text-[11px]">vbmeta</code>,{' '}
                    <code className="text-[11px]">system</code>).
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
                <span>Open Extractor</span>
                <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>

          {/* 3. Output History */}
          <Card
            className="group relative cursor-pointer rounded-xl border-border bg-surface transition-all duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
            onClick={() => onNavigateTab('history')}
          >
            <CardContent className="flex h-full flex-col justify-between p-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                    <History className="size-4.5" />
                  </div>
                  <Badge variant="secondary">Outputs</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                    Extracted Outputs & History
                  </h3>
                  <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                    View extracted image files, reveal destination folders in file explorer, and
                    review past extraction jobs.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
                <span>View Output History</span>
                <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: 3-Step Quick Start Workflow Guide (Placed 2nd right after shortcuts) */}
      <Card className="rounded-xl border-border bg-surface shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-body">
            <CheckCircle2 className="size-4 text-primary" />
            3-Step Extraction Workflow
          </CardTitle>
          <CardDescription className="text-caption">
            Recommended path for extracting and using Android firmware partition images
          </CardDescription>
        </CardHeader>
        <CardContent className="grid @lg:grid-cols-3 grid-cols-1 gap-4 pt-0">
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-5.5 items-center justify-center rounded-full bg-primary font-mono font-semibold text-[11px] text-primary-foreground">
                1
              </span>
              <h4 className="font-medium text-caption text-foreground">Select Payload Source</h4>
            </div>
            <p className="text-caption text-muted-foreground leading-relaxed">
              Open the <strong>Extractor</strong> tab to drop a local payload file or paste an
              official OEM OTA download URL.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-5.5 items-center justify-center rounded-full bg-primary font-mono font-semibold text-[11px] text-primary-foreground">
                2
              </span>
              <h4 className="font-medium text-caption text-foreground">Select Partitions</h4>
            </div>
            <p className="text-caption text-muted-foreground leading-relaxed">
              Switch to <strong>Extractor</strong> tab, use search or category filters to select
              target partitions (e.g. boot, vbmeta).
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-5.5 items-center justify-center rounded-full bg-primary font-mono font-semibold text-[11px] text-primary-foreground">
                3
              </span>
              <h4 className="font-medium text-caption text-foreground">Extract & Deploy</h4>
            </div>
            <p className="text-caption text-muted-foreground leading-relaxed">
              Run batch extraction directly to your output folder and flash extracted images via{' '}
              <strong>Fastboot</strong> or <strong>Flasher</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Engine Capabilities Matrix */}
      <div>
        <div className="mb-3">
          <h2 className="font-semibold text-foreground text-title">Engine Capabilities</h2>
          <p className="text-caption text-muted-foreground">
            Core capabilities and architecture of the ADB GUI Next extraction engine
          </p>
        </div>

        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3.5">
          {/* Remote Streaming */}
          <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
            <CardContent className="flex items-start gap-3.5 p-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <Radio className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-body text-foreground">
                  Zero-Disk-Waste Remote Streaming
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Stream Android OTAs directly over HTTP/HTTPS using range requests. The engine
                  locates central directories and CrAU headers without downloading full
                  multi-gigabyte packages.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Root & Kernel Fast-Path */}
          <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
            <CardContent className="flex items-start gap-3.5 p-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <Cpu className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-body text-foreground">Root & Kernel Fast-Path</h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Extract individual boot, init_boot, vendor_boot, and vbmeta images for Magisk,
                  KernelSU, or APatch patching in seconds instead of unpacking full OS images.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Universal Payload Support */}
          <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
            <CardContent className="flex items-start gap-3.5 p-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <FileCode2 className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-body text-foreground">Universal Payload Support</h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Engine handles standard Android Full & Incremental Delta OTA payloads, factory
                  image archives, raw payload.bin blobs, and vendor-packaged firmware containers.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Native Rust Performance */}
          <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
            <CardContent className="flex items-start gap-3.5 p-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <Zap className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-body text-foreground">
                  High-Performance Native Backend
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Built on Tokio async I/O, zero-copy memory mapping, Rayon multi-threaded
                  parallelism, and native decompressors (XZ, ZSTD, LZMA, BZ2) for maximum extraction
                  throughput.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Partition (super.img) Unpacker */}
          <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
            <CardContent className="flex items-start gap-3.5 p-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <PackageOpen className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-body text-foreground">
                  Dynamic Partition (super.img) Sub-Unpacker
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Native lp metadata geometry parser and sparse block unpacker extracts system,
                  vendor, product, and odm sub-partitions from monolithic super.img containers.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4: Stream Engine Mechanics */}
      <PayloadStreamDiagnostics />
    </div>
  );
}
