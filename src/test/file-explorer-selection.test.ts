import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it } from "vitest";

import { useFileExplorerSelection } from "@/features/file-explorer/hooks/use-file-explorer-selection";
import type { FileEntry } from "@/features/file-explorer/model/file-explorer-types";

const file: FileEntry = {
  date: "2026-01-01",
  linkTarget: "",
  name: "photo.jpg",
  permissions: "-rw-rw----",
  size: "12",
  time: "12:00",
  type: "File",
};

const clickEvent = (overrides: Partial<MouseEvent> = {}): MouseEvent =>
  ({
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
    shiftKey: false,
    ...overrides,
  }) as MouseEvent;

describe(useFileExplorerSelection, () => {
  it("treats menu Select like Ctrl+click and ignores the leftover row click", () => {
    const { result } = renderHook(() =>
      useFileExplorerSelection({
        fileList: [file],
        renamingName: null,
        visibleList: [file],
      })
    );

    act(() => {
      result.current.handleSelectFromMenu(file.name);
    });

    expect(result.current.isMultiSelectMode).toBeTruthy();
    expect(result.current.selectedNames.has(file.name)).toBeTruthy();

    act(() => {
      result.current.handleRowClick(file, clickEvent());
    });

    expect(result.current.isMultiSelectMode).toBeTruthy();
    expect(result.current.selectedNames.has(file.name)).toBeTruthy();
  });

  it("swallows the leftover empty-pane click after menu Select", () => {
    const { result } = renderHook(() =>
      useFileExplorerSelection({
        fileList: [file],
        renamingName: null,
        visibleList: [file],
      })
    );

    act(() => {
      result.current.handleSelectFromMenu(file.name);
    });

    expect(result.current.consumeGhostClick()).toBeTruthy();
    expect(result.current.consumeGhostClick()).toBeFalsy();
    expect(result.current.isMultiSelectMode).toBeTruthy();
  });
});
