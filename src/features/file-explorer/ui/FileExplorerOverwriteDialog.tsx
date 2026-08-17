import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { buttonVariants } from '@/shared/ui/button-variants';

interface Props {
  isBusy: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function FileExplorerOverwriteDialog({ isBusy, onConfirm, onOpenChange, open }: Props) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="min-w-0 overflow-hidden">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle>Replace existing items?</AlertDialogTitle>
          <AlertDialogDescription>
            One or more items already exist in this folder. Replace them, or cancel to leave the
            device unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? (
              <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
            ) : (
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            )}
            Replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
