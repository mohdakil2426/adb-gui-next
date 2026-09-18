import type { FlasherConfirm } from "@/features/flasher/hooks/use-flasher-actions";
import { FlashConfirmDialog } from "@/features/flasher/ui/flash-confirm-dialog";
import { SideloadConfirmDialog } from "@/features/flasher/ui/sideload-confirm-dialog";

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
export const FlasherConfirmations = ({
  fastbootSerial,
  imagePath,
  onConfirmFlash,
  onConfirmSideload,
  onOpenChange,
  packagePath,
  partition,
  pending,
  sideloadSerial,
}: FlasherConfirmationsProps) => (
  <>
    <FlashConfirmDialog
      imagePath={imagePath}
      onConfirm={onConfirmFlash}
      onOpenChange={onOpenChange}
      open={pending === "flash"}
      partition={partition}
      serial={fastbootSerial}
    />
    <SideloadConfirmDialog
      onConfirm={onConfirmSideload}
      onOpenChange={onOpenChange}
      open={pending === "sideload"}
      packagePath={packagePath}
      serial={sideloadSerial}
    />
  </>
);
