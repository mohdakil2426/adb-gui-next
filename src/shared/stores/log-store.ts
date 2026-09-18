import { create } from "zustand";

const MAX_LOGS = 1000;

export type LogLevel = "info" | "error" | "success" | "warning";

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
  type: LogLevel;
}

interface LogStore {
  activeTab: "logs" | "shell";

  addLog: (message: string, type: LogLevel) => void;
  clearLogs: () => void;
  filter: LogLevel | "all";
  isFollowing: boolean;
  isOpen: boolean;
  isPanelMaximized: boolean;
  logs: LogEntry[];
  panelHeight: number;
  resetUnreadCount: () => void;
  searchQuery: string;
  setActiveTab: (tab: "logs" | "shell") => void;
  setFilter: (filter: LogLevel | "all") => void;
  setIsFollowing: (following: boolean) => void;
  setPanelHeight: (height: number) => void;
  setPanelOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleMaximized: () => void;
  togglePanel: () => void;
  unreadCount: number;
}

const formatTimestamp = (): string => new Date().toISOString().slice(11, 23);

export const useLogStore = create<LogStore>((set) => ({
  activeTab: "logs",
  addLog: (message: string, type: LogLevel) => {
    set((state: LogStore) => ({
      logs: [
        ...state.logs,
        {
          id: crypto.randomUUID(),
          message,
          timestamp: formatTimestamp(),
          type,
        },
      ].slice(-MAX_LOGS),
      unreadCount: state.isOpen ? state.unreadCount : state.unreadCount + 1,
    }));
  },
  clearLogs: () => {
    set({ logs: [], unreadCount: 0 });
  },
  filter: "all",
  isFollowing: true,
  isOpen: false,
  isPanelMaximized: false,
  logs: [],
  panelHeight: 300,
  resetUnreadCount: () => {
    set({ unreadCount: 0 });
  },
  searchQuery: "",
  setActiveTab: (tab: "logs" | "shell") => {
    set({ activeTab: tab });
  },
  setFilter: (filter: LogLevel | "all") => {
    set({ filter });
  },
  setIsFollowing: (following: boolean) => {
    set({ isFollowing: following });
  },
  setPanelHeight: (height: number) => {
    set({ panelHeight: height });
  },
  setPanelOpen: (isOpen: boolean) => {
    set((state) => ({ isOpen, unreadCount: isOpen ? 0 : state.unreadCount }));
  },
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
  toggleMaximized: () => {
    set((state: LogStore) => ({ isPanelMaximized: !state.isPanelMaximized }));
  },
  togglePanel: () => {
    set((state: LogStore) => ({
      isOpen: !state.isOpen,
      unreadCount: state.isOpen ? state.unreadCount : 0,
    }));
  },
  unreadCount: 0,
}));
