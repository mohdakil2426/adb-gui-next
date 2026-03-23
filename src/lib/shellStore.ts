import { create } from 'zustand';

export interface HistoryEntry {
  type: 'command' | 'result' | 'error';
  text: string;
}

interface ShellStore {
  history: HistoryEntry[];
  commandHistory: string[];

  addHistoryEntry: (entry: HistoryEntry) => void;
  setHistory: (history: HistoryEntry[]) => void;
  clearHistory: () => void;
  addCommand: (command: string) => void;
}

export const useShellStore = create<ShellStore>((set) => ({
  history: [],
  commandHistory: [],

  addHistoryEntry: (entry: HistoryEntry) =>
    set((state) => ({ history: [...state.history, entry] })),

  setHistory: (history: HistoryEntry[]) => set({ history }),

  clearHistory: () => set({ history: [] }),

  addCommand: (command: string) =>
    set((state) => ({
      commandHistory: [...state.commandHistory, command],
    })),
}));
