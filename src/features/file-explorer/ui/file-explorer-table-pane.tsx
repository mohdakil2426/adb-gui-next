import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";

import { useFileExplorerColumnWidths } from "@/features/file-explorer/hooks/use-file-explorer-column-widths";
import type {
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerSelection,
  FileExplorerStatus,
  SortDir,
  SortField,
} from "@/features/file-explorer/model/file-explorer-types";
import { FileExplorerClipboardMenuItems } from "@/features/file-explorer/ui/file-explorer-clipboard-menu-items";
import { FileExplorerColumnResizeHandle } from "@/features/file-explorer/ui/file-explorer-column-resize-handle";
import { FileExplorerCreateMenuItems } from "@/features/file-explorer/ui/file-explorer-create-menu-items";
import {
  EmptyDirectoryState,
  FileExplorerRowSkeleton,
  LoadFailedState,
  NoDeviceState,
  PermissionDeniedState,
} from "@/features/file-explorer/ui/file-explorer-table-states";
import { FileExplorerVirtualBody } from "@/features/file-explorer/ui/file-explorer-virtual-body";
import { FE_DROP_OVER_CLASS } from "@/features/file-explorer/utils/file-explorer-drop";
import { Checkbox } from "@/shared/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/shared/ui/context-menu";
import { Table, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/cn";

interface Props {
  actions: FileExplorerActions;
  editing: FileExplorerEditing;
  listing: FileExplorerListing;
  rootAccessGranted: boolean;
  selection: FileExplorerSelection;
  status: FileExplorerStatus;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

/** `date` already compares `date + time`, so one "Date modified" column sorts both. */
const SORTABLE_COLUMNS: { field: SortField; label: string }[] = [
  { field: "name", label: "Name" },
  { field: "date", label: "Date modified" },
  { field: "type", label: "Type" },
  { field: "size", label: "Size" },
];

type PaneState = "loading" | "no-device" | "permission-denied" | "failed" | "empty" | "listing";

const resolvePaneState = (
  listing: FileExplorerListing,
  editing: FileExplorerEditing,
  status: FileExplorerStatus
): PaneState => {
  if (status.isLoading) {
    return "loading";
  }
  if (!status.hasDevice || listing.loadError === "no_device") {
    return "no-device";
  }
  if (listing.loadError === "permission_denied") {
    return "permission-denied";
  }
  if (listing.loadError !== null) {
    return "failed";
  }
  if (listing.fileList.length === 0 && editing.creatingType === null) {
    return "empty";
  }
  return "listing";
};

const getAriaSort = (
  field: SortField,
  sortField: SortField,
  sortDir: SortDir
): "ascending" | "descending" | "none" => {
  if (sortField !== field) {
    return "none";
  }
  return sortDir === "asc" ? "ascending" : "descending";
};

const getSelectAllChecked = (
  allSelected: boolean,
  someSelected: boolean
): boolean | "indeterminate" => {
  if (allSelected) {
    return true;
  }
  if (someSelected) {
    return "indeterminate";
  }
  return false;
};

const renderSortIcon = (field: SortField, sortField: SortField, sortDir: SortDir) => {
  if (sortField !== field) {
    return null;
  }
  if (sortDir === "asc") {
    return <ChevronUp aria-hidden="true" className="size-3.5" />;
  }
  return <ChevronDown aria-hidden="true" className="size-3.5" />;
};

export const FileExplorerTablePane = ({
  actions,
  editing,
  listing,
  rootAccessGranted,
  selection,
  status,
  tableScrollRef,
}: Props) => {
  const paneState = resolvePaneState(listing, editing, status);
  const { fileTableColumns, resizeColumn } = useFileExplorerColumnWidths();
  const showSelectAll = selection.isMultiSelectMode;

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (actions.consumeGhostClick()) {
        return;
      }
      if (editing.renamingName || editing.creatingType) {
        return;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (
        !element?.closest(
          "[data-index], [data-slot=table-head], button, input, [role=checkbox], [role=separator]"
        )
      ) {
        actions.clearSelection();
      }
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [actions, editing.creatingType, editing.renamingName, tableScrollRef]);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <section
          aria-label="Files table"
          className={cn(
            "min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            FE_DROP_OVER_CLASS
          )}
          data-fe-drop-pane={listing.currentPath}
          onPointerDown={(event) => {
            if (actions.consumeGhostClick()) {
              return;
            }
            if (editing.renamingName || editing.creatingType) {
              return;
            }
            const element = event.target instanceof Element ? event.target : null;
            if (
              !element?.closest(
                "[data-index], [data-slot=table-head], button, input, [role=checkbox], [role=separator]"
              )
            ) {
              actions.clearSelection();
            }
          }}
          ref={tableScrollRef}
        >
          {paneState === "loading" ? <FileExplorerRowSkeleton /> : null}
          {paneState === "no-device" ? <NoDeviceState /> : null}
          {paneState === "permission-denied" ? (
            <PermissionDeniedState rootAccessGranted={rootAccessGranted} />
          ) : null}
          {paneState === "failed" ? <LoadFailedState onRetry={actions.handleRefreshClick} /> : null}
          {paneState === "empty" ? (
            <EmptyDirectoryState
              disabled={status.isBusy}
              onCreateFile={actions.startCreateFile}
              onCreateFolder={actions.startCreateFolder}
            />
          ) : null}
          {paneState === "listing" ? (
            <div className="relative min-h-full w-full">
              <Table className="min-w-0">
                <TableHeader className="sticky top-0 z-10 block border-border border-b bg-surface">
                  <TableRow
                    className="group/header grid hover:bg-transparent"
                    style={{ gridTemplateColumns: fileTableColumns }}
                  >
                    {SORTABLE_COLUMNS.map(({ field, label }) => (
                      <TableHead
                        aria-sort={getAriaSort(field, listing.sortField, listing.sortDir)}
                        className="relative h-9 min-w-0 px-3 text-label text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        key={field}
                      >
                        <div className="flex h-full min-w-0 items-center gap-1 pr-2">
                          {field === "name" && showSelectAll ? (
                            <span className="flex size-4 shrink-0 items-center justify-center">
                              <Checkbox
                                aria-label="Select all"
                                checked={getSelectAllChecked(
                                  selection.allSelected,
                                  selection.someSelected
                                )}
                                disabled={status.isBusy}
                                onCheckedChange={actions.handleSelectAll}
                              />
                            </span>
                          ) : null}
                          <button
                            className="inline-flex min-w-0 items-center gap-1"
                            onClick={() => {
                              actions.handleSortColumn(field);
                            }}
                            type="button"
                          >
                            {label}
                            {renderSortIcon(field, listing.sortField, listing.sortDir)}
                          </button>
                        </div>
                        {field === "name" ? (
                          <FileExplorerColumnResizeHandle
                            label="Resize name column"
                            onDelta={(dx) => {
                              resizeColumn("name", dx);
                            }}
                          />
                        ) : null}
                        {field === "date" ? (
                          <FileExplorerColumnResizeHandle
                            label="Resize date modified column"
                            onDelta={(dx) => {
                              resizeColumn("date", dx);
                            }}
                          />
                        ) : null}
                        {field === "type" ? (
                          <FileExplorerColumnResizeHandle
                            label="Resize type column"
                            onDelta={(dx) => {
                              resizeColumn("type", dx);
                            }}
                          />
                        ) : null}
                        {field === "size" ? (
                          <FileExplorerColumnResizeHandle
                            label="Resize size column"
                            onDelta={(dx) => {
                              resizeColumn("size", dx);
                            }}
                          />
                        ) : null}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <FileExplorerVirtualBody
                  actions={actions}
                  editing={editing}
                  fileTableColumns={fileTableColumns}
                  listing={listing}
                  selection={selection}
                  status={status}
                  tableScrollRef={tableScrollRef}
                />
              </Table>
            </div>
          ) : null}
        </section>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <FileExplorerClipboardMenuItems
          disabled={status.isBusy}
          onPaste={actions.handlePaste}
          pasteEnabled={status.pasteEnabled}
          showCopy={false}
          showPaste
        />
        <FileExplorerCreateMenuItems
          disabled={status.isBusy}
          onCreateFile={actions.startCreateFile}
          onCreateFolder={actions.startCreateFolder}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
};
