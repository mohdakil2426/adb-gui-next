import { create } from 'zustand';
import type { backend } from '@/lib/desktop/models';

export type EmulatorManagerTab = 'overview' | 'launch' | 'root' | 'restore';
export type EmulatorPendingAction =
  | 'launch'
  | 'stop'
  | 'rootPrepare'
  | 'rootFinalize'
  | 'restore'
  | 'refreshPlan'
  | null;

export interface RootSessionState {
  avdName: string;
  serial: string;
  normalizedPackagePath: string;
  fakeBootRemotePath: string;
  instructions: string[];
}

export interface EmulatorActivityItem {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface EmulatorManagerState {
  selectedAvdName: string | null;
  activeTab: EmulatorManagerTab;
  activity: EmulatorActivityItem[];
  rootSession: RootSessionState | null;
  restorePlan: backend.RestorePlan | null;
  pendingAction: EmulatorPendingAction;
  setSelectedAvdName: (name: string | null) => void;
  setActiveTab: (tab: EmulatorManagerTab) => void;
  appendActivity: (item: Omit<EmulatorActivityItem, 'id' | 'timestamp'>) => void;
  clearActivity: () => void;
  setRootSession: (session: RootSessionState | null) => void;
  clearRootSession: () => void;
  setRestorePlan: (plan: backend.RestorePlan | null) => void;
  setPendingAction: (action: EmulatorPendingAction) => void;
  reset: () => void;
}

const MAX_ACTIVITY_ITEMS = 100;

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function createActivityId(): string {
  return `${Date.now()}-${Math.round(Math.random() * 100_000)}`;
}

const INITIAL_STATE = {
  selectedAvdName: null,
  activeTab: 'overview' as EmulatorManagerTab,
  activity: [] as EmulatorActivityItem[],
  rootSession: null as RootSessionState | null,
  restorePlan: null as backend.RestorePlan | null,
  pendingAction: null as EmulatorPendingAction,
};

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  ...INITIAL_STATE,

  setSelectedAvdName: (selectedAvdName) => set({ selectedAvdName }),
  setActiveTab: (activeTab) => set({ activeTab }),
  appendActivity: (item) =>
    set((state) => ({
      activity: [
        ...state.activity,
        {
          ...item,
          id: createActivityId(),
          timestamp: formatTimestamp(),
        },
      ].slice(-MAX_ACTIVITY_ITEMS),
    })),
  clearActivity: () => set({ activity: [] }),
  setRootSession: (rootSession) => set({ rootSession }),
  clearRootSession: () => set({ rootSession: null }),
  setRestorePlan: (restorePlan) => set({ restorePlan }),
  setPendingAction: (pendingAction) => set({ pendingAction }),
  reset: () => set({ ...INITIAL_STATE }),
}));
