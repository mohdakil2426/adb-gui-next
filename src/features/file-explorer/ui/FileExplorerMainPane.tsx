import { memo } from 'react';
import type {
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerSelection,
  FileExplorerStatus,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerTablePane } from '@/features/file-explorer/ui/FileExplorerTablePane';

interface Props {
  actions: FileExplorerActions;
  editing: FileExplorerEditing;
  listing: FileExplorerListing;
  rootAccessGranted: boolean;
  selection: FileExplorerSelection;
  status: FileExplorerStatus;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

export const FileExplorerMainPane = memo(function FileExplorerMainPane({
  actions,
  editing,
  listing,
  rootAccessGranted,
  selection,
  status,
  tableScrollRef,
}: Props) {
  const selectedCount = selection.selectedNames.size;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      >
        {selectedCount > 0 ? `${selectedCount} item${selectedCount > 1 ? 's' : ''} selected` : null}
      </div>
      <FileExplorerTablePane
        actions={actions}
        editing={editing}
        listing={listing}
        rootAccessGranted={rootAccessGranted}
        selection={selection}
        status={status}
        tableScrollRef={tableScrollRef}
      />
    </div>
  );
});
