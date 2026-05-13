import { FileJson, Save } from 'lucide-react';
import { CopyButton } from '@/shared/components/CopyButton';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export function GetVarDialog({
  getVarContent,
  onClose,
  onOpenChange,
  onSave,
  open,
}: {
  getVarContent: string;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[80vh] w-[95vw] max-w-2xl flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="size-5" />
                Fastboot Variables
              </DialogTitle>
              <DialogDescription>
                Output of <code>fastboot getvar all</code>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <CopyButton label="Variables" value={getVarContent} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Save to Log"
                    disabled={!getVarContent}
                    onClick={onSave}
                    size="icon"
                    variant="outline"
                  >
                    <Save className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save to Log</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] w-full overflow-y-auto rounded-md border bg-muted/50 p-4">
          <pre className="whitespace-pre-wrap font-mono text-muted-foreground text-xs">
            {getVarContent || 'No output received.'}
          </pre>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
