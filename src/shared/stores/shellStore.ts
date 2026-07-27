import { create } from 'zustand';

/** Mirrors `logStore`'s MAX_LOGS discipline — the transcript is not an archive. */
const MAX_HISTORY_ENTRIES = 500;
/** `adb logcat -d` / `pm list packages` routinely return megabytes in one entry. */
const MAX_ENTRY_CHARS = 20_000;

export interface HistoryEntry {
  id: string;
  text: string;
  type: 'command' | 'result' | 'error';
}

/** Input shape for writes; `id` is assigned by the store when omitted. */
export type HistoryEntryInput = Omit<HistoryEntry, 'id'> & { id?: string };

function truncateText(text: string): string {
  if (text.length <= MAX_ENTRY_CHARS) {
    return text;
  }
  const omitted = text.length - MAX_ENTRY_CHARS;
  return `${text.slice(0, MAX_ENTRY_CHARS)}\n… output truncated (${omitted.toLocaleString()} more characters)`;
}

function ensureHistoryEntry(entry: HistoryEntryInput): HistoryEntry {
  return {
    id: entry.id ?? crypto.randomUUID(),
    text: truncateText(entry.text),
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
    set((state) => ({
      history: [...state.history, ensureHistoryEntry(entry)].slice(-MAX_HISTORY_ENTRIES),
    }));
  },

  setHistory: (history) => {
    set({ history: history.map(ensureHistoryEntry).slice(-MAX_HISTORY_ENTRIES) });
  },

  clearHistory: () => {
    set({ history: [] });
  },

  addCommand: (command) => {
    set((state) => ({
      commandHistory: [...state.commandHistory, command].slice(-MAX_HISTORY_ENTRIES),
    }));
  },
}));
