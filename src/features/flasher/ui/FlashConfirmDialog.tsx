import { useEffect, useState } from 'react';
import { RunFastbootHostCommand } from '@/desktop/backend';
import { isHighRiskPartition, parseGetVar } from '@/features/flasher/utils/flasherRisk';
import { type ConfirmDetail, ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { getFileName } from '@/shared/utils/filePath';

interface FlashConfirmDialogProps {
  imagePath: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  partition: string;
  serial: string | null;
}

/**
 * The confirmation that `fastboot flash` never had.
 *
 * Names the exact device, partition, active slot and image before anything is
 * written, and escalates to type-to-confirm for partitions that brick.
 */
export function FlashConfirmDialog({
  imagePath,
  onConfirm,
  onOpenChange,
  open,
  partition,
  serial,
}: FlashConfirmDialogProps) {
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [codename, setCodename] = useState<string | null>(null);

  // Read-only probes; they run only while the dialog is open.
  useEffect(() => {
    if (!(open && serial)) {
      return;
    }

    let cancelled = false;
    setActiveSlot(null);
    setCodename(null);

    Promise.all([
      RunFastbootHostCommand('getvar current-slot', serial).catch(() => ''),
      RunFastbootHostCommand('getvar product', serial).catch(() => ''),
    ])
      .then(([slotOutput, productOutput]) => {
        if (cancelled) {
          return;
        }
        setActiveSlot(parseGetVar(slotOutput, 'current-slot'));
        setCodename(parseGetVar(productOutput, 'product'));
      })
      .catch(() => {
        /* probe failure just leaves the fields unknown */
      });

    return () => {
      cancelled = true;
    };
  }, [open, serial]);

  const imageName = getFileName(imagePath);
  const highRisk = isHighRiskPartition(partition);
  const deviceLabel = codename ?? 'this device';

  const details: ConfirmDetail[] = [
    { label: 'Target', mono: true, value: serial ?? 'unknown' },
    { label: 'Mode', value: 'fastboot' },
    {
      label: 'Partition',
      mono: true,
      value: activeSlot ? `${partition}  (active slot ${activeSlot})` : partition,
    },
    { label: 'Image', mono: true, value: imageName },
    { label: 'Path', mono: true, value: imagePath },
  ];

  return (
    <ConfirmDialog
      confirmLabel={`Flash ${partition}`}
      confirmPhrase={highRisk ? partition : undefined}
      consequence={
        <div className="flex flex-col gap-1">
          <p>
            Flashing the wrong image can leave the device unable to boot. Make sure{' '}
            <span className="font-mono text-mono">{imageName}</span> was built for{' '}
            <span className="font-mono text-mono">{deviceLabel}</span>.
          </p>
          {highRisk ? (
            <p>
              <span className="font-mono text-mono">{partition}</span> is a high-risk partition — a
              bad write here is not recoverable from fastboot.
            </p>
          ) : null}
        </div>
      }
      description="This writes the selected image directly to the device. It cannot be undone."
      details={details}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={`Flash ${partition} partition?`}
    />
  );
}
