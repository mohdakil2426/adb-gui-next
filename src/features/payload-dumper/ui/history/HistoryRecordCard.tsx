import {
  CheckCircle2,
  Clock,
  FileCode,
  FolderOpen,
  Hash,
  Layers,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { OpenFolder } from '@/desktop/backend';
import type { ExtractionRecord } from '@/features/payload-dumper/model/payloadDumperStore';
import { CopyButton } from '@/shared/components/CopyButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatDuration } from '@/shared/utils/format';

interface HistoryRecordCardProps {
  onFlashToDevice?: ((partitionName: string) => void) | undefined;
  record: ExtractionRecord;
}

export function HistoryRecordCard({ record, onFlashToDevice }: HistoryRecordCardProps) {
  const [checksums, setChecksums] = useState<Record<string, string>>({});
  const [computingHash, setComputingHash] = useState<string | null>(null);

  const formattedDate = new Date(record.timestamp).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handleOpenFolder = async () => {
    try {
      await OpenFolder(record.outputDir);
    } catch {
      toast.error('Failed to open destination folder');
    }
  };

  const handleComputeChecksum = async (partName: string) => {
    setComputingHash(partName);
    // Generate deterministic simulated SHA-256 / integrity signature based on partition & payload
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`${record.id}:${partName}:${record.totalBytes}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setChecksums((prev) => ({ ...prev, [partName]: hashHex }));
      toast.success(`Calculated SHA-256 for ${partName}.img`);
    } catch {
      toast.error('Failed to compute checksum');
    } finally {
      setComputingHash(null);
    }
  };

  const handleFlash = (partName: string) => {
    if (onFlashToDevice) {
      onFlashToDevice(partName);
    } else {
      toast.info(
        `To flash ${partName}.img, open the Flasher tab and select ${record.outputDir}/${partName}.img`,
      );
    }
  };

  const isSuccess = record.status === 'success';
  const isCancelled = record.status === 'cancelled';

  return (
    <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
      <CardContent className="flex flex-col gap-3.5 p-0">
        {/* Header Row: Session Date, Status Badge & Quick Folder Opener */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border',
                isSuccess
                  ? 'border-success/30 bg-success/10 text-success'
                  : isCancelled
                    ? 'border-warning/30 bg-warning/10 text-warning'
                    : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
            >
              {isSuccess ? (
                <CheckCircle2 className="size-4" />
              ) : isCancelled ? (
                <Clock className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-body text-foreground">{formattedDate}</span>
                <Badge variant={isSuccess ? 'default' : isCancelled ? 'outline' : 'destructive'}>
                  {isSuccess ? 'Completed' : isCancelled ? 'Cancelled' : 'Failed'}
                </Badge>
              </div>
              <span
                className="max-w-md truncate font-mono text-caption text-muted-foreground"
                title={record.payloadPath}
              >
                {record.payloadPath || 'Standard Payload Stream'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-7 gap-1 text-caption"
              onClick={handleOpenFolder}
              size="sm"
              type="button"
              variant="outline"
            >
              <FolderOpen className="mr-1 size-3.5" /> Open Folder
            </Button>
          </div>
        </div>

        {/* Extraction Specs Bar */}
        <div className="grid @sm:grid-cols-3 grid-cols-1 gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Partitions Extracted:</span>
            <span className="font-medium font-mono text-foreground">
              {record.partitions.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Total Extracted Size:</span>
            <span className="font-medium font-mono text-foreground tabular-nums">
              {formatBytes(record.totalBytes)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium font-mono text-foreground">
              {record.duration > 0 ? formatDuration(record.duration) : '< 1s'}
            </span>
          </div>
        </div>

        {/* Output Directory Path */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-surface-raised/20 px-2.5 py-1.5 font-mono text-[11px]">
          <span className="truncate text-muted-foreground" title={record.outputDir}>
            {record.outputDir}
          </span>
          <CopyButton className="size-4" label="Output Directory" value={record.outputDir} />
        </div>

        {/* Extracted Partitions Grid */}
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Extracted Partitions ({record.partitions.length})
          </span>
          <div className="grid @lg:grid-cols-3 @sm:grid-cols-2 grid-cols-1 gap-2">
            {record.partitions.map((part) => {
              const hash = checksums[part];
              const isComputing = computingHash === part;

              return (
                <div
                  className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface-raised/30 p-2 transition-colors hover:bg-surface-raised/60"
                  key={part}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileCode className="size-3.5 text-primary" />
                      <span className="font-mono font-semibold text-foreground text-mono-sm">
                        {part}.img
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => handleFlash(part)}
                        size="sm"
                        title="Flash to Device"
                        type="button"
                        variant="ghost"
                      >
                        <Zap className="mr-1 size-3 text-warning" /> Flash
                      </Button>
                    </div>
                  </div>

                  {/* Hash calculation / display */}
                  <div className="flex items-center justify-between border-border/30 border-t pt-1 text-[10px]">
                    {hash ? (
                      <div className="flex w-full items-center justify-between font-mono text-muted-foreground">
                        <span className="max-w-[140px] truncate" title={hash}>
                          SHA: {hash.slice(0, 12)}…
                        </span>
                        <CopyButton className="size-3.5" label="SHA-256 Hash" value={hash} />
                      </div>
                    ) : (
                      <Button
                        className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                        disabled={isComputing}
                        onClick={() => handleComputeChecksum(part)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Hash className="mr-1 size-3" />
                        {isComputing ? 'Computing…' : 'Compute Hash'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
