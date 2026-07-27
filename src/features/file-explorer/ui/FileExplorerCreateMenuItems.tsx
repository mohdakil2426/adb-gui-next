import { FilePlus2, FolderPlus } from 'lucide-react';
import { ContextMenuItem } from '@/shared/ui/context-menu';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';

interface Props {
  disabled: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
}

/** New file / New folder entries, shared by the table-pane menu and the
 *  row menu's no-row fallback so both surfaces stay identical. */
export function FileExplorerCreateMenuItems({ disabled, onCreateFile, onCreateFolder }: Props) {
  return (
    <>
      <ContextMenuItem disabled={disabled} onClick={onCreateFile}>
        <FilePlus2 aria-hidden="true" className="size-4 shrink-0" />
        New file
        <KbdGroup className="ml-auto pl-4">
          <Kbd>Ctrl</Kbd>
          <Kbd>N</Kbd>
        </KbdGroup>
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onClick={onCreateFolder}>
        <FolderPlus aria-hidden="true" className="size-4 shrink-0" />
        New folder
        <KbdGroup className="ml-auto pl-4">
          <Kbd>Ctrl</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>N</Kbd>
        </KbdGroup>
      </ContextMenuItem>
    </>
  );
}
