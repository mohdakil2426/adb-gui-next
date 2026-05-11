import { create } from 'zustand';

const MAX_LOGS = 1000;

export type LogLevel = 'info' | 'error' | 'success' | 'warning';

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
  type: LogLevel;
}

interface LogStore {
  activeTab: 'logs' | 'shell';

  addLog: (message: string, type: LogLevel) => void;
  clearLogs: () => void;
  filter: LogLevel | 'all';
  isFollowing: boolean;
  isOpen: boolean;
  isPanelMaximized: boolean;
  logs: LogEntry[];
  panelHeight: number;
  resetUnreadCount: () => void;
  searchQuery: string;
  setActiveTab: (tab: 'logs' | 'shell') => void;
  setFilter: (filter: LogLevel | 'all') => void;
  setIsFollowing: (following: boolean) => void;
  setPanelHeight: (height: number) => void;
  setPanelOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleMaximized: () => void;
  togglePanel: () => void;
  unreadCount: number;
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

  addLog: (message: string, type: LogLevel) => {
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
    }));
  },

  clearLogs: () => {
    set({ logs: [], unreadCount: 0 });
  },

  togglePanel: () => {
    set((state: LogStore) => ({
      isOpen: !state.isOpen,
      unreadCount: state.isOpen ? state.unreadCount : 0,
    }));
  },

  setPanelOpen: (isOpen: boolean) => {
    set((state) => ({ isOpen, unreadCount: isOpen ? 0 : state.unreadCount }));
  },

  setFilter: (filter: LogLevel | 'all') => {
    set({ filter });
  },
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
  setIsFollowing: (following: boolean) => {
    set({ isFollowing: following });
  },
  toggleMaximized: () => {
    set((state: LogStore) => ({ isPanelMaximized: !state.isPanelMaximized }));
  },
  setActiveTab: (tab: 'logs' | 'shell') => {
    set({ activeTab: tab });
  },
  resetUnreadCount: () => {
    set({ unreadCount: 0 });
  },
  setPanelHeight: (height: number) => {
    set({ panelHeight: height });
  },
}));
