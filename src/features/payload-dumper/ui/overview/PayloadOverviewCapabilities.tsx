import { CheckCircle2, Cpu, FileCode2, PackageOpen, Radio, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function PayloadOverviewCapabilities() {
  return (
    <>
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

      <div>
        <div className="mb-3">
          <h2 className="font-semibold text-foreground text-title">Engine Capabilities</h2>
          <p className="text-caption text-muted-foreground">
            Core capabilities and architecture of the ADB GUI Next extraction engine
          </p>
        </div>

        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3.5">
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
    </>
  );
}
