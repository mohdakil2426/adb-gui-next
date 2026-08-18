import { Binary, FileCode, Layers, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

type GuideSection = 'structure' | 'operations' | 'manifest' | 'delta';

export function PayloadArchitectureGuide() {
  const [activeSection, setActiveSection] = useState<GuideSection>('structure');

  return (
    <Card className="flex flex-col justify-between rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <h3 className="font-semibold text-foreground text-title">
            Android OTA & Payload.bin Architecture Guide
          </h3>
          <p className="text-caption text-muted-foreground">
            Interactive reference for Google update_engine binary format & block operations
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap gap-1">
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setActiveSection('structure')}
            size="sm"
            type="button"
            variant={activeSection === 'structure' ? 'default' : 'outline'}
          >
            <Binary className="mr-1 size-3" /> Binary Structure
          </Button>
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setActiveSection('operations')}
            size="sm"
            type="button"
            variant={activeSection === 'operations' ? 'default' : 'outline'}
          >
            <Zap className="mr-1 size-3" /> Blob Operations
          </Button>
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setActiveSection('manifest')}
            size="sm"
            type="button"
            variant={activeSection === 'manifest' ? 'default' : 'outline'}
          >
            <FileCode className="mr-1 size-3" /> Protobuf Manifest
          </Button>
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setActiveSection('delta')}
            size="sm"
            type="button"
            variant={activeSection === 'delta' ? 'default' : 'outline'}
          >
            <Layers className="mr-1 size-3" /> Full vs Delta OTA
          </Button>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col justify-between p-0 pt-2">
        {activeSection === 'structure' && (
          <div className="flex flex-col gap-3">
            {/* ASCII Binary Layout Diagram */}
            <div className="overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3 font-mono text-[11px] text-foreground leading-relaxed">
              <pre className="font-mono text-mono-sm">
                {`+-----------------------------------------------------------------------------------------+
|                                ANDROID PAYLOAD.BIN STRUCTURE                            |
+-----------------------------------------------------------------------------------------+
| [0x00 - 0x03] Magic Bytes: "CrAU" (0x43, 0x72, 0x41, 0x55) - Chrome/Android Update     |
| [0x04 - 0x0B] File Format Version: uint64 (Version 2 for Android 8.0 - 15+)           |
| [0x0C - 0x13] Manifest Size: uint64 (Size in bytes of the Protobuf manifest)            |
| [0x14 - 0x17] (v2 only) Manifest Signature Size: uint32                                 |
+-----------------------------------------------------------------------------------------+
| [Offset: 0x18] DELTA ARCHIVE MANIFEST (Google Protocol Buffers serialized)              |
|   - Block Size (e.g., 4096 bytes)                                                       |
|   - Dynamic Partition Metadata (Super group definitions, max group capacities)          |
|   - Array of PartitionUpdate descriptors (boot, system, vendor, product, etc.)         |
|   - Operations list per partition (type, data_offset, data_length, src/dst extents)     |
+-----------------------------------------------------------------------------------------+
| [Offset: 0x18 + ManifestSize + SigSize] PAYLOAD DATA BLOBS                              |
|   - Contiguous compressed/uncompressed raw extent bytes referenced by data_offset       |
|   - SHA-256 block hash for each extent to ensure hardware cryptographic integrity       |
+-----------------------------------------------------------------------------------------+
| [Offset: EOF - PayloadSignatureSize] METADATA SIGNATURE & EOF FOOTER                    |
+-----------------------------------------------------------------------------------------+`}
              </pre>
            </div>

            <div className="grid @sm:grid-cols-2 grid-cols-1 gap-2.5 text-body">
              <div className="flex flex-col gap-1 rounded-md border border-border/50 bg-surface-raised/30 p-2.5">
                <span className="flex items-center gap-1.5 font-medium text-caption text-foreground">
                  <Binary className="size-3.5 text-primary" /> Magic Header & Versioning
                </span>
                <p className="text-[12px] text-muted-foreground">
                  The <code className="font-mono text-foreground">CrAU</code> header marks the
                  payload.bin specification derived from Chromium OS update engine. Version 2
                  introduced 64-bit manifest sizing and per-operation signatures.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-md border border-border/50 bg-surface-raised/30 p-2.5">
                <span className="flex items-center gap-1.5 font-medium text-caption text-foreground">
                  <ShieldCheck className="size-3.5 text-success" /> Cryptographic Integrity
                </span>
                <p className="text-[12px] text-muted-foreground">
                  Every partition extent and manifest operation carries a 32-byte SHA-256 digest.
                  Extractor verifies these hashes block-by-block during decompression.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'operations' && (
          <div className="flex flex-col gap-2.5">
            <div className="grid @sm:grid-cols-2 grid-cols-1 gap-2">
              <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-semibold text-mono text-primary">REPLACE</code>
                  <Badge variant="outline">Uncompressed</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Raw uncompressed 4096-byte blocks streamed directly into target partition image at
                  specified destination extents.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-semibold text-mono text-primary">REPLACE_XZ</code>
                  <Badge variant="outline">LZMA2 Stream</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  High-ratio LZMA2 compressed stream with multi-threaded chunk decompression
                  directly to memory buffers.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-semibold text-mono text-primary">REPLACE_BZ</code>
                  <Badge variant="outline">Bzip2 Stream</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Legacy Bzip2 block compression used in older Android OTA archives (Android 8 -
                  10).
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-semibold text-mono text-primary">ZERO</code>
                  <Badge variant="outline">Sparse Hole</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Sparse zeroes written to destination extents without reading data blobs,
                  optimizing sparse filesystem generation.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border/40 bg-surface-raised/20 p-2 text-caption text-muted-foreground">
              <strong className="text-foreground">Zstandard (ZSTD) Support:</strong> Android 12+
              introduced Zstandard compression (<code>REPLACE_ZSTD</code>) for ultra-fast
              decompression at near-LZMA ratios.
            </div>
          </div>
        )}

        {activeSection === 'manifest' && (
          <div className="flex flex-col gap-2">
            <p className="text-caption text-muted-foreground">
              The DeltaArchiveManifest protobuf schema contains critical metadata describing device
              dynamic partition layout:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3 font-mono text-[11px] text-foreground">
              <pre className="font-mono text-mono-sm">
                {`message DeltaArchiveManifest {
  optional uint32 block_size = 1 [default = 4096];
  repeated PartitionUpdate partitions = 2;
  optional DynamicPartitionMetadata dynamic_partition_metadata = 3;
  optional uint64 max_timestamp = 4;
  optional uint32 security_patch_level = 5;
}

message PartitionUpdate {
  required string partition_name = 1;
  repeated InstallOperation operations = 2;
  optional PartitionInfo old_partition_info = 3;
  optional PartitionInfo new_partition_info = 4; // Contains expected size & SHA-256 hash
  optional uint64 estimate_cow_size = 5;
}`}
              </pre>
            </div>
          </div>
        )}

        {activeSection === 'delta' && (
          <div className="grid @sm:grid-cols-2 grid-cols-1 gap-3">
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="default">Full OTA Package</Badge>
                <span className="text-caption text-muted-foreground">Self-contained</span>
              </div>
              <p className="text-body text-muted-foreground">
                Contains complete replacement partition images. Every extent is reconstructed from{' '}
                <code className="font-mono text-foreground">REPLACE</code>,{' '}
                <code className="font-mono text-foreground">REPLACE_XZ</code>, or{' '}
                <code className="font-mono text-foreground">ZERO</code> operations with zero source
                dependencies.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-caption text-muted-foreground">
                <li>Extractable standalone with 100% precision</li>
                <li>
                  Produces clean flashable raw <code className="font-mono">.img</code> files
                </li>
                <li>Ideal for Fastboot flashing & Magisk/KernelSU patching</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Delta (Incremental) OTA</Badge>
                <span className="text-caption text-muted-foreground">Differential</span>
              </div>
              <p className="text-body text-muted-foreground">
                Contains binary diff patches (
                <code className="font-mono text-foreground">SOURCE_BSDIFF</code>,{' '}
                <code className="font-mono text-foreground">PUFFDIFF</code>) that require the exact
                previous OS build partitions to reconstruct new target images.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-caption text-muted-foreground">
                <li>Requires source partition image directory</li>
                <li>Bandwidth-efficient for minor security patches</li>
                <li>
                  Identified by non-zero <code className="font-mono">minor_version</code> in
                  manifest
                </li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
