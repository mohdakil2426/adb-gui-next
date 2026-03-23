import { create } from 'zustand';

const MAX_LOGS = 1000;

export type LogLevel = 'info' | 'error' | 'success' | 'warning';

export interface LogEntry {
  id: string;
  message: string;
  type: LogLevel;
  timestamp: string;
}

interface LogStore {
  logs: LogEntry[];
  isOpen: boolean;
  filter: LogLevel | 'all';
  searchQuery: string;
  isFollowing: boolean;
  isPanelMaximized: boolean;
  activeTab: 'logs' | 'shell';
  unreadCount: number;
  panelHeight: number;

  addLog: (message: string, type: LogLevel) => void;
  clearLogs: () => void;
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
  setFilter: (filter: LogLevel | 'all') => void;
  setSearchQuery: (query: string) => void;
  setIsFollowing: (following: boolean) => void;
  toggleMaximized: () => void;
  setActiveTab: (tab: 'logs' | 'shell') => void;
  resetUnreadCount: () => void;
  setPanelHeight: (height: number) => void;
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  isOpen: false,
  filter: 'all',
  searchQuery: '',
  isFollowing: true,
  isPanelMaximized: false,
  activeTab: 'logs',
  unreadCount: 0,
  panelHeight: 300,

  addLog: (message: string, type: LogLevel) =>
    set((state: LogStore) => ({
      logs: [
        ...state.logs,
        {
          id: crypto.randomUUID(),
          message,
          type,
          timestamp: formatTimestamp(),
        },
      ].slice(-MAX_LOGS),
      unreadCount: state.isOpen ? state.unreadCount : state.unreadCount + 1,
    })),

  clearLogs: () => set({ logs: [], unreadCount: 0 }),

  togglePanel: () =>
    set((state: LogStore) => ({
      isOpen: !state.isOpen,
      unreadCount: !state.isOpen ? 0 : state.unreadCount,
    })),

  setPanelOpen: (isOpen: boolean) =>
    set({ isOpen, unreadCount: isOpen ? 0 : undefined } as Partial<LogStore>),

  setFilter: (filter: LogLevel | 'all') => set({ filter }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setIsFollowing: (following: boolean) => set({ isFollowing: following }),
  toggleMaximized: () => set((state: LogStore) => ({ isPanelMaximized: !state.isPanelMaximized })),
  setActiveTab: (tab: 'logs' | 'shell') => set({ activeTab: tab }),
  resetUnreadCount: () => set({ unreadCount: 0 }),
  setPanelHeight: (height: number) => set({ panelHeight: height }),
}));
