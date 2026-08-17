import { ClipboardPaste, Copy, Scissors } from 'lucide-react';
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';

interface Props {
  disabled: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste: () => void;
  pasteEnabled: boolean;
  showCopy: boolean;
  showPaste: boolean;
}

export function FileExplorerClipboardMenuItems({
  disabled,
  onCopy,
  onCut,
  onPaste,
  pasteEnabled,
  showCopy,
  showPaste,
}: Props) {
  return (
    <>
      {showCopy && onCopy && onCut ? (
        <>
          <ContextMenuItem disabled={disabled} onClick={onCopy}>
            <Copy aria-hidden="true" className="size-4 shrink-0" />
            Copy
            <KbdGroup className="ml-auto pl-4">
              <Kbd>Ctrl</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </ContextMenuItem>
          <ContextMenuItem disabled={disabled} onClick={onCut}>
            <Scissors aria-hidden="true" className="size-4 shrink-0" />
            Cut
            <KbdGroup className="ml-auto pl-4">
              <Kbd>Ctrl</Kbd>
              <Kbd>X</Kbd>
            </KbdGroup>
          </ContextMenuItem>
        </>
      ) : null}
      {showPaste ? (
        <ContextMenuItem disabled={disabled || !pasteEnabled} onClick={onPaste}>
          <ClipboardPaste aria-hidden="true" className="size-4 shrink-0" />
          Paste
          <KbdGroup className="ml-auto pl-4">
            <Kbd>Ctrl</Kbd>
            <Kbd>V</Kbd>
          </KbdGroup>
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
    </>
  );
}
