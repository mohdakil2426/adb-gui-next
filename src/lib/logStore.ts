import { create } from 'zustand';

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  timestamp: string;
}

interface LogStore {
  logs: LogEntry[];
  isOpen: boolean;
  addLog: (message: string, type: 'info' | 'error' | 'success' | 'warning') => void;
  clearLogs: () => void;
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  isOpen: false,
  addLog: (message: string, type: 'info' | 'error' | 'success' | 'warning') =>
    set((state: LogStore) => ({
      logs: [
        ...state.logs,
        {
          id: crypto.randomUUID(),
          message,
          type,
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
  togglePanel: () => set((state: LogStore) => ({ isOpen: !state.isOpen })),
  setPanelOpen: (isOpen: boolean) => set({ isOpen }),
}));
