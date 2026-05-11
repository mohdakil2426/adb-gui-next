import { create } from "zustand";

export interface HistoryEntry {
  text: string;
  type: "command" | "result" | "error";
}

interface ShellStore {
  addCommand: (command: string) => void;

  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  commandHistory: string[];
  history: HistoryEntry[];
  setHistory: (history: HistoryEntry[]) => void;
}

export const useShellStore = create<ShellStore>((set) => ({
  history: [],
  commandHistory: [],

  addHistoryEntry: (entry: HistoryEntry) => {
    set((state) => ({ history: [...state.history, entry] }));
  },

  setHistory: (history: HistoryEntry[]) => {
    set({ history });
  },

  clearHistory: () => {
    set({ history: [] });
  },

  addCommand: (command: string) => {
    set((state) => ({
      commandHistory: [...state.commandHistory, command],
    }));
  },
}));
