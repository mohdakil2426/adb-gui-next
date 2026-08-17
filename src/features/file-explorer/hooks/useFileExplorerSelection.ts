import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

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
  | { type: 'ADD_ONE'; name: string }
  | { type: 'ADD_RANGE'; names: string[] }
  | { type: 'CLEAR' }
  | { type: 'SELECT_ONE'; name: string }
  | { type: 'SET_MODE'; payload: SetStateAction<boolean> }
  | { type: 'SET_NAMES'; payload: SetStateAction<Set<string>> }
  | { type: 'TOGGLE'; name: string }
  | { type: 'TOGGLE_ALL'; names: string[] };

const INITIAL_SELECTION: SelectionState = {
  isMultiSelectMode: false,
  selectedNames: new Set(),
};

/** Pure reducer: selection set and multi-select mode always move together,
 *  which is what makes every selection callback identity-stable. */
function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'CLEAR':
      return state.selectedNames.size === 0 && !state.isMultiSelectMode ? state : INITIAL_SELECTION;
    case 'TOGGLE': {
      const selectedNames = new Set(state.selectedNames);
      if (selectedNames.has(action.name)) {
        selectedNames.delete(action.name);
      } else {
        selectedNames.add(action.name);
      }
      return { isMultiSelectMode: selectedNames.size > 0, selectedNames };
    }
    case 'ADD_RANGE': {
      const selectedNames = new Set(state.selectedNames);
      for (const name of action.names) {
        selectedNames.add(name);
      }
      return { isMultiSelectMode: true, selectedNames };
    }
    case 'ADD_ONE': {
      const selectedNames = new Set(state.selectedNames);
      selectedNames.add(action.name);
      return { isMultiSelectMode: true, selectedNames };
    }
    case 'SELECT_ONE':
      return { isMultiSelectMode: false, selectedNames: new Set([action.name]) };
    case 'TOGGLE_ALL': {
      if (action.names.length > 0 && state.selectedNames.size === action.names.length) {
        return INITIAL_SELECTION;
      }
      return { isMultiSelectMode: true, selectedNames: new Set(action.names) };
    }
    case 'SET_NAMES': {
      const selectedNames =
        typeof action.payload === 'function' ? action.payload(state.selectedNames) : action.payload;
      if (selectedNames === state.selectedNames) {
        return state;
      }
      return {
        isMultiSelectMode:
          selectedNames.size === 0
            ? false
            : selectedNames.size > 1
              ? true
              : state.isMultiSelectMode,
        selectedNames,
      };
    }
    case 'SET_MODE': {
      const isMultiSelectMode =
        typeof action.payload === 'function'
          ? action.payload(state.isMultiSelectMode)
          : action.payload;
      return isMultiSelectMode === state.isMultiSelectMode
        ? state
        : { ...state, isMultiSelectMode };
    }
  }
}

export function useFileExplorerSelection(
  options: UseFileExplorerSelectionOptions,
): UseFileExplorerSelectionResult {
  const { fileList, renamingName, visibleList } = options;
  const [{ isMultiSelectMode, selectedNames }, dispatch] = useReducer(
    selectionReducer,
    INITIAL_SELECTION,
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
    [fileList, selectedNames],
  );
  const singleSelected = selectedList.length === 1 ? (selectedList[0] ?? null) : null;
  const allSelected = fileList.length > 0 && selectedNames.size === fileList.length;
  const someSelected = selectedNames.size > 0 && !allSelected;

  const clearSelection = useCallback(() => {
    lastClickedIndexRef.current = null;
    dispatch({ type: 'CLEAR' });
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
            type: 'ADD_RANGE',
            names: visible.slice(start, end + 1).map((entry) => entry.name),
          });
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        dispatch({ type: 'TOGGLE', name: file.name });
        return;
      }
      if (consumeGhostClick()) {
        return;
      }
      const clickedIndex = visible.findIndex((entry) => entry.name === file.name);
      if (clickedIndex !== -1) {
        lastClickedIndexRef.current = clickedIndex;
      }
      dispatch({ type: 'SELECT_ONE', name: file.name });
    },
    [consumeGhostClick],
  );

  const toggleCheckbox = useCallback((name: string) => {
    dispatch({ type: 'TOGGLE', name });
  }, []);

  const handleSelectAll = useCallback(() => {
    lastClickedIndexRef.current = null;
    dispatch({ type: 'TOGGLE_ALL', names: fileListRef.current.map((file) => file.name) });
  }, []);

  const handleSelectFromMenu = useCallback((name: string) => {
    ignorePlainClickRef.current = true;
    dispatch({ type: 'ADD_ONE', name });
  }, []);

  const setSelectedNames = useCallback<Dispatch<SetStateAction<Set<string>>>>((payload) => {
    dispatch({ type: 'SET_NAMES', payload });
  }, []);

  const setIsMultiSelectMode = useCallback<Dispatch<SetStateAction<boolean>>>((payload) => {
    dispatch({ type: 'SET_MODE', payload });
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
}
