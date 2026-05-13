import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

interface UseFileExplorerSelectionOptions {
  fileList: FileEntry[];
  renamingName: string | null;
  visibleList: FileEntry[];
}

interface UseFileExplorerSelectionResult {
  allSelected: boolean;
  clearSelection: () => void;
  handleRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  handleSelectAll: () => void;
  handleSelectFromMenu: (name: string) => void;
  isMultiSelectMode: boolean;
  selectedList: FileEntry[];
  selectedNames: Set<string>;
  setIsMultiSelectMode: Dispatch<SetStateAction<boolean>>;
  setSelectedNames: Dispatch<SetStateAction<Set<string>>>;
  singleSelected: FileEntry | null;
  someSelected: boolean;
  toggleCheckbox: (name: string) => void;
}

export function useFileExplorerSelection(
  options: UseFileExplorerSelectionOptions,
): UseFileExplorerSelectionResult {
  const { fileList, renamingName, visibleList } = options;
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);

  const selectedList = useMemo(
    () => fileList.filter((file) => selectedNames.has(file.name)),
    [fileList, selectedNames],
  );
  const singleSelected = selectedList.length === 1 ? (selectedList[0] ?? null) : null;
  const allSelected = fileList.length > 0 && selectedNames.size === fileList.length;
  const someSelected = selectedNames.size > 0 && !allSelected;

  const clearSelection = useCallback(() => {
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
    lastClickedIndexRef.current = null;
  }, []);

  const handleRowClick = useCallback(
    (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => {
      if (renamingName) {
        return;
      }
      if (e.shiftKey && lastClickedIndexRef.current !== null) {
        e.preventDefault();
        const clickedIndex = visibleList.findIndex((entry) => entry.name === file.name);
        if (clickedIndex !== -1) {
          const start = Math.min(lastClickedIndexRef.current, clickedIndex);
          const end = Math.max(lastClickedIndexRef.current, clickedIndex);
          const rangeNames = visibleList.slice(start, end + 1).map((entry) => entry.name);
          setIsMultiSelectMode(true);
          setSelectedNames((prev) => {
            const next = new Set(prev);
            for (const name of rangeNames) {
              next.add(name);
            }
            return next;
          });
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        setIsMultiSelectMode(true);
        setSelectedNames((prev) => {
          const next = new Set(prev);
          if (next.has(file.name)) {
            next.delete(file.name);
          } else {
            next.add(file.name);
          }
          if (next.size === 0) {
            setIsMultiSelectMode(false);
          }
          return next;
        });
        return;
      }
      const clickedIndex = visibleList.findIndex((entry) => entry.name === file.name);
      if (clickedIndex !== -1) {
        lastClickedIndexRef.current = clickedIndex;
      }
    },
    [renamingName, visibleList],
  );

  const toggleCheckbox = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      if (next.size === 0) {
        setIsMultiSelectMode(false);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedNames(new Set(fileList.map((file) => file.name)));
      setIsMultiSelectMode(true);
    }
  }, [allSelected, clearSelection, fileList]);

  const handleSelectFromMenu = useCallback((name: string) => {
    setIsMultiSelectMode(true);
    setSelectedNames((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  return {
    allSelected,
    clearSelection,
    handleRowClick,
    handleSelectAll,
    handleSelectFromMenu,
    isMultiSelectMode,
    selectedList,
    selectedNames,
    setIsMultiSelectMode,
    setSelectedNames,
    singleSelected,
    someSelected,
    toggleCheckbox,
  };
}
