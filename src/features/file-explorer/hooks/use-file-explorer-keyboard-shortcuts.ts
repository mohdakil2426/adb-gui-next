import { useEffect, useRef } from "react";

import type { CreatingType, FileEntry } from "@/features/file-explorer/model/file-explorer-types";

interface Options {
  activeView: string;
  cancelCreate: () => void;
  clearSelection: () => void;
  creatingType: CreatingType;
  currentPathRef: React.RefObject<string>;
  fileListRef: React.RefObject<FileEntry[]>;
  handleCopy: (names: Iterable<string>) => void;
  handleCopyPath: (names: Iterable<string>) => void;
  handleCut: (names: Iterable<string>) => void;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleNavigateUp: () => void;
  handlePaste: () => void;
  handlePathClick: () => void;
  handleRenameCancel: () => void;
  handleRowDoubleClick: (file: FileEntry) => void;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  renamingName: string | null;
  searchQuery: string;
  selectedNames: Set<string>;
  setIsMultiSelectMode: (enabled: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSelectedNames: (next: Set<string>) => void;
  startCreate: (type: "file" | "folder") => void;
  startRename: (entry: FileEntry) => void;
  visibleList: FileEntry[];
}

const isInputElement = (el: unknown): boolean =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);

const handleCreateShortcut = (
  e: KeyboardEvent,
  mod: boolean,
  startCreate: Options["startCreate"]
): boolean => {
  if (mod && !e.shiftKey && e.key === "n") {
    e.preventDefault();
    startCreate("file");
    return true;
  }
  if (mod && e.shiftKey && e.key === "N") {
    e.preventDefault();
    startCreate("folder");
    return true;
  }
  return false;
};

const handleNavShortcut = (
  e: KeyboardEvent,
  mod: boolean,
  options: Pick<
    Options,
    | "currentPathRef"
    | "handleGoBack"
    | "handleGoForward"
    | "handleNavigateUp"
    | "handlePathClick"
    | "loadFiles"
  >
): boolean => {
  if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    options.handleGoBack();
    return true;
  }
  if (e.altKey && e.key === "ArrowRight") {
    e.preventDefault();
    options.handleGoForward();
    return true;
  }
  if ((e.altKey && e.key === "ArrowUp") || (e.key === "Backspace" && !mod)) {
    e.preventDefault();
    options.handleNavigateUp();
    return true;
  }
  if ((mod && e.key === "l") || (e.altKey && e.key.toLowerCase() === "d")) {
    e.preventDefault();
    options.handlePathClick();
    return true;
  }
  if (mod && e.key === "f") {
    e.preventDefault();
    document.querySelector<HTMLElement>("#fe-search-input")?.focus();
    return true;
  }
  if (e.key === "F5") {
    e.preventDefault();
    void options.loadFiles(options.currentPathRef.current ?? "/sdcard/", false);
    return true;
  }
  return false;
};

const handleEscapeShortcut = (
  e: KeyboardEvent,
  options: Pick<
    Options,
    | "cancelCreate"
    | "clearSelection"
    | "creatingType"
    | "handleRenameCancel"
    | "renamingName"
    | "searchQuery"
    | "selectedNames"
    | "setSearchQuery"
  >
): boolean => {
  if (e.key !== "Escape") {
    return false;
  }
  if (options.creatingType) {
    options.cancelCreate();
  } else if (options.renamingName) {
    options.handleRenameCancel();
  } else if (options.searchQuery) {
    options.setSearchQuery("");
  } else if (options.selectedNames.size > 0) {
    options.clearSelection();
  }
  return true;
};

const handleClipboardShortcut = (
  e: KeyboardEvent,
  mod: boolean,
  options: Pick<
    Options,
    "handleCopy" | "handleCopyPath" | "handleCut" | "handlePaste" | "selectedNames"
  >
): boolean => {
  if (!mod) {
    return false;
  }
  if (e.shiftKey && e.key.toLowerCase() === "c") {
    e.preventDefault();
    void options.handleCopyPath(options.selectedNames);
    return true;
  }
  if (!e.shiftKey && e.key === "c") {
    e.preventDefault();
    options.handleCopy(options.selectedNames);
    return true;
  }
  if (e.key === "x") {
    e.preventDefault();
    options.handleCut(options.selectedNames);
    return true;
  }
  if (e.key === "v") {
    e.preventDefault();
    options.handlePaste();
    return true;
  }
  return false;
};

const handleItemActionShortcut = (
  e: KeyboardEvent,
  options: Pick<
    Options,
    | "fileListRef"
    | "handleRowDoubleClick"
    | "openDeleteDialog"
    | "selectedNames"
    | "startRename"
    | "visibleList"
  >
): boolean => {
  const { selectedNames } = options;
  if (e.key === "Delete" && selectedNames.size > 0) {
    e.preventDefault();
    options.openDeleteDialog([...selectedNames]);
    return true;
  }
  if (selectedNames.size === 1) {
    const [name] = selectedNames;
    if (e.key === "F2") {
      e.preventDefault();
      const file = (options.fileListRef.current ?? []).find((entry) => entry.name === name);
      if (file) {
        options.startRename(file);
      }
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const file = options.visibleList.find((entry) => entry.name === name);
      if (file) {
        options.handleRowDoubleClick(file);
      }
      return true;
    }
  }
  return false;
};

const handleSelectionJumpShortcut = (
  e: KeyboardEvent,
  mod: boolean,
  options: Pick<
    Options,
    "fileListRef" | "setIsMultiSelectMode" | "setSelectedNames" | "visibleList"
  >
): boolean => {
  if (e.key === "Home") {
    e.preventDefault();
    const [first] = options.visibleList;
    if (!first) {
      return true;
    }
    if (e.shiftKey) {
      options.setIsMultiSelectMode(true);
      options.setSelectedNames(new Set(options.visibleList.map((entry) => entry.name).slice(0, 1)));
      return true;
    }
    options.setSelectedNames(new Set([first.name]));
    return true;
  }
  if (e.key === "End") {
    e.preventDefault();
    const last = options.visibleList.at(-1);
    if (!last) {
      return true;
    }
    options.setSelectedNames(new Set([last.name]));
    return true;
  }
  if (e.key === "F10" && e.shiftKey) {
    e.preventDefault();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
      focused.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    }
    return true;
  }
  if (mod && e.key === "a") {
    e.preventDefault();
    options.setIsMultiSelectMode(true);
    options.setSelectedNames(
      new Set((options.fileListRef.current ?? []).map((entry) => entry.name))
    );
    return true;
  }
  return false;
};

export const useFileExplorerKeyboardShortcuts = (options: Options) => {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (isInputElement(e.target) || isInputElement(document.activeElement)) {
        return;
      }
      if (opts.activeView !== "files") {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (handleCreateShortcut(e, mod, opts.startCreate)) {
        return;
      }
      if (handleNavShortcut(e, mod, opts)) {
        return;
      }
      if (handleEscapeShortcut(e, opts)) {
        return;
      }
      if (handleClipboardShortcut(e, mod, opts)) {
        return;
      }
      if (handleItemActionShortcut(e, opts)) {
        return;
      }
      handleSelectionJumpShortcut(e, mod, opts);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};
