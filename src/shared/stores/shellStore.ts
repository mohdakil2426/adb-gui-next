import { create } from 'zustand';

export interface HistoryEntry {
  id: string;
  text: string;
  type: 'command' | 'result' | 'error';
}

/** Input shape for writes; `id` is assigned by the store when omitted. */
export type HistoryEntryInput = Omit<HistoryEntry, 'id'> & { id?: string };

function ensureHistoryEntry(entry: HistoryEntryInput): HistoryEntry {
  return {
    id: entry.id ?? crypto.randomUUID(),
    text: entry.text,
    type: entry.type,
  };
}

interface ShellStore {
  addCommand: (command: string) => void;

  addHistoryEntry: (entry: HistoryEntryInput) => void;
  clearHistory: () => void;
  commandHistory: string[];
  history: HistoryEntry[];
  setHistory: (history: HistoryEntryInput[]) => void;
}

export const useShellStore = create<ShellStore>((set) => ({
  history: [],
  commandHistory: [],

  addHistoryEntry: (entry) => {
    set((state) => ({ history: [...state.history, ensureHistoryEntry(entry)] }));
  },

  setHistory: (history) => {
    set({ history: history.map(ensureHistoryEntry) });
  },

  clearHistory: () => {
    set({ history: [] });
  },

  addCommand: (command) => {
    set((state) => ({
      commandHistory: [...state.commandHistory, command],
    }));
  },
}));
