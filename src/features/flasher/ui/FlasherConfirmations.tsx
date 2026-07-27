import type { FlasherConfirm } from '@/features/flasher/hooks/useFlasherActions';
import { FlashConfirmDialog } from '@/features/flasher/ui/FlashConfirmDialog';
import { SideloadConfirmDialog } from '@/features/flasher/ui/SideloadConfirmDialog';

interface FlasherConfirmationsProps {
  fastbootSerial: string | null;
  imagePath: string;
  onConfirmFlash: () => void;
  onConfirmSideload: () => void;
  onOpenChange: (open: boolean) => void;
  packagePath: string;
  partition: string;
  pending: FlasherConfirm;
  sideloadSerial: string | null;
}

/** Both flasher confirmations, kept out of the view body. */
export function FlasherConfirmations({
  fastbootSerial,
  imagePath,
  onConfirmFlash,
  onConfirmSideload,
  onOpenChange,
  packagePath,
  partition,
  pending,
  sideloadSerial,
}: FlasherConfirmationsProps) {
  return (
    <>
      <FlashConfirmDialog
        imagePath={imagePath}
        onConfirm={onConfirmFlash}
        onOpenChange={onOpenChange}
        open={pending === 'flash'}
        partition={partition}
        serial={fastbootSerial}
      />
      <SideloadConfirmDialog
        onConfirm={onConfirmSideload}
        onOpenChange={onOpenChange}
        open={pending === 'sideload'}
        packagePath={packagePath}
        serial={sideloadSerial}
      />
    </>
  );
}
