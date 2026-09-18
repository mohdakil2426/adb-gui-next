import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { FileEntry } from "@/features/file-explorer/model/file-explorer-types";

interface UseFileExplorerSelectionOptions {
  fileList: FileEntry[];
  renamingName: string | null;
  visibleList: FileEntry[];
}

interface UseFileExplorerSelectionResult {
  allSelected: boolean;
  clearSelection: () => void;
  consumeGhostClick: () => boolean;
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

interface SelectionState {
  isMultiSelectMode: boolean;
  selectedNames: Set<string>;
}

type SelectionAction =
  | { type: "ADD_ONE"; name: string }
  | { type: "ADD_RANGE"; names: string[] }
  | { type: "CLEAR" }
  | { type: "SELECT_ONE"; name: string }
  | { type: "SET_MODE"; payload: SetStateAction<boolean> }
  | { type: "SET_NAMES"; payload: SetStateAction<Set<string>> }
  | { type: "TOGGLE"; name: string }
  | { type: "TOGGLE_ALL"; names: string[] };

const INITIAL_SELECTION: SelectionState = {
  isMultiSelectMode: false,
  selectedNames: new Set(),
};

/** Pure reducer: selection set and multi-select mode always move together,
 *  which is what makes every selection callback identity-stable. */
const resolveMultiSelectMode = (size: number, prevMode: boolean): boolean => {
  if (size === 0) {
    return false;
  }
  if (size > 1) {
    return true;
  }
  return prevMode;
};

/** Pure reducer: selection set and multi-select mode always move together,
 *  which is what makes every selection callback identity-stable. */
const selectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
  switch (action.type) {
    case "CLEAR": {
      return state.selectedNames.size === 0 && !state.isMultiSelectMode ? state : INITIAL_SELECTION;
    }
    case "TOGGLE": {
      const selectedNames = new Set(state.selectedNames);
      if (selectedNames.has(action.name)) {
        selectedNames.delete(action.name);
      } else {
        selectedNames.add(action.name);
      }
      return { isMultiSelectMode: selectedNames.size > 0, selectedNames };
    }
    case "ADD_RANGE": {
      const selectedNames = new Set(state.selectedNames);
      for (const name of action.names) {
        selectedNames.add(name);
      }
      return { isMultiSelectMode: true, selectedNames };
    }
    case "ADD_ONE": {
      return {
        isMultiSelectMode: true,
        selectedNames: new Set([...state.selectedNames, action.name]),
      };
    }
    case "SELECT_ONE": {
      return {
        isMultiSelectMode: false,
        selectedNames: new Set([action.name]),
      };
    }
    case "TOGGLE_ALL": {
      if (action.names.length > 0 && state.selectedNames.size === action.names.length) {
        return INITIAL_SELECTION;
      }
      return { isMultiSelectMode: true, selectedNames: new Set(action.names) };
    }
    case "SET_NAMES": {
      const selectedNames =
        typeof action.payload === "function" ? action.payload(state.selectedNames) : action.payload;
      if (selectedNames === state.selectedNames) {
        return state;
      }
      return {
        isMultiSelectMode: resolveMultiSelectMode(selectedNames.size, state.isMultiSelectMode),
        selectedNames,
      };
    }
    case "SET_MODE": {
      const isMultiSelectMode =
        typeof action.payload === "function"
          ? action.payload(state.isMultiSelectMode)
          : action.payload;
      return isMultiSelectMode === state.isMultiSelectMode
        ? state
        : { ...state, isMultiSelectMode };
    }
    default: {
      return state;
    }
  }
};

export const useFileExplorerSelection = (
  options: UseFileExplorerSelectionOptions
): UseFileExplorerSelectionResult => {
  const { fileList, renamingName, visibleList } = options;
  const [{ isMultiSelectMode, selectedNames }, dispatch] = useReducer(
    selectionReducer,
    INITIAL_SELECTION
  );
  const lastClickedIndexRef = useRef<number | null>(null);
  const ignorePlainClickRef = useRef(false);

  // Latest-value refs so the callbacks below never need these in their deps.
  const fileListRef = useRef(fileList);
  const renamingNameRef = useRef(renamingName);
  const visibleListRef = useRef(visibleList);
  useEffect(() => {
    fileListRef.current = fileList;
    renamingNameRef.current = renamingName;
    visibleListRef.current = visibleList;
  }, [fileList, renamingName, visibleList]);

  const selectedList = useMemo(
    () => fileList.filter((file) => selectedNames.has(file.name)),
    [fileList, selectedNames]
  );
  const singleSelected = selectedList.length === 1 ? (selectedList[0] ?? null) : null;
  const allSelected = fileList.length > 0 && selectedNames.size === fileList.length;
  const someSelected = selectedNames.size > 0 && !allSelected;

  const clearSelection = useCallback(() => {
    lastClickedIndexRef.current = null;
    dispatch({ type: "CLEAR" });
  }, []);

  const consumeGhostClick = useCallback(() => {
    if (!ignorePlainClickRef.current) {
      return false;
    }
    ignorePlainClickRef.current = false;
    return true;
  }, []);

  const handleRowClick = useCallback(
    (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => {
      if (renamingNameRef.current) {
        return;
      }
      const visible = visibleListRef.current;
      if (e.shiftKey && lastClickedIndexRef.current !== null) {
        e.preventDefault();
        const clickedIndex = visible.findIndex((entry) => entry.name === file.name);
        if (clickedIndex !== -1) {
          const start = Math.min(lastClickedIndexRef.current, clickedIndex);
          const end = Math.max(lastClickedIndexRef.current, clickedIndex);
          dispatch({
            names: visible.slice(start, end + 1).map((entry) => entry.name),
            type: "ADD_RANGE",
          });
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        dispatch({ name: file.name, type: "TOGGLE" });
        return;
      }
      if (consumeGhostClick()) {
        return;
      }
      const clickedIndex = visible.findIndex((entry) => entry.name === file.name);
      if (clickedIndex !== -1) {
        lastClickedIndexRef.current = clickedIndex;
      }
      dispatch({ name: file.name, type: "SELECT_ONE" });
    },
    [consumeGhostClick]
  );

  const toggleCheckbox = useCallback((name: string) => {
    dispatch({ name, type: "TOGGLE" });
  }, []);

  const handleSelectAll = useCallback(() => {
    lastClickedIndexRef.current = null;
    dispatch({
      names: fileListRef.current.map((file) => file.name),
      type: "TOGGLE_ALL",
    });
  }, []);

  const handleSelectFromMenu = useCallback((name: string) => {
    ignorePlainClickRef.current = true;
    dispatch({ name, type: "ADD_ONE" });
  }, []);

  const setSelectedNames = useCallback<Dispatch<SetStateAction<Set<string>>>>((payload) => {
    dispatch({ payload, type: "SET_NAMES" });
  }, []);

  const setIsMultiSelectMode = useCallback<Dispatch<SetStateAction<boolean>>>((payload) => {
    dispatch({ payload, type: "SET_MODE" });
  }, []);

  return {
    allSelected,
    clearSelection,
    consumeGhostClick,
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
};
