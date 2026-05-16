import { File, Folder, Link, Loader2, Trash2 } from 'lucide-react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
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

interface DeleteDialogProps {
  fileList: FileEntry[];
  filesToDelete: string[];
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  filesToDelete,
  fileList,
  isDeleting,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="min-w-0 overflow-hidden">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
            {filesToDelete.length === 1
              ? `Delete "${filesToDelete[0]}"?`
              : `Delete ${filesToDelete.length} items?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild className="min-w-0">
            <div>
              <p>
                {filesToDelete.length === 1
                  ? 'This item will be permanently deleted from the device. This action cannot be undone.'
                  : 'These items will be permanently deleted from the device. This action cannot be undone.'}
              </p>
              {filesToDelete.length > 1 && (
                <ul className="mt-2 flex min-w-0 flex-col gap-0.5 font-mono text-xs">
                  {filesToDelete.slice(0, 5).map((name) => {
                    const file = fileList.find((entry) => entry.name === name);
                    return (
                      <li className="flex min-w-0 items-start gap-1.5" key={name}>
                        {file?.type === 'Directory' ? (
                          <Folder className="size-3 shrink-0" />
                        ) : file?.type === 'Symlink' ? (
                          <Link className="size-3 shrink-0" />
                        ) : (
                          <File className="size-3 shrink-0" />
                        )}
                        <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                      </li>
                    );
                  })}
                  {filesToDelete.length > 5 && (
                    <li className="text-muted-foreground">… and {filesToDelete.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="min-w-0">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="size-4 shrink-0" />
            )}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
