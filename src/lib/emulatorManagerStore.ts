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

interface EmulatorManagerState {
  selectedAvdName: string | null;
  activeTab: EmulatorManagerTab;
  rootSession: RootSessionState | null;
  restorePlan: backend.RestorePlan | null;
  pendingAction: EmulatorPendingAction;
  setSelectedAvdName: (name: string | null) => void;
  setActiveTab: (tab: EmulatorManagerTab) => void;
  setRootSession: (session: RootSessionState | null) => void;
  clearRootSession: () => void;
  setRestorePlan: (plan: backend.RestorePlan | null) => void;
  setPendingAction: (action: EmulatorPendingAction) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  selectedAvdName: null,
  activeTab: 'overview' as EmulatorManagerTab,
  rootSession: null as RootSessionState | null,
  restorePlan: null as backend.RestorePlan | null,
  pendingAction: null as EmulatorPendingAction,
};

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  ...INITIAL_STATE,

  setSelectedAvdName: (selectedAvdName) => set({ selectedAvdName }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setRootSession: (rootSession) => set({ rootSession }),
  clearRootSession: () => set({ rootSession: null }),
  setRestorePlan: (restorePlan) => set({ restorePlan }),
  setPendingAction: (pendingAction) => set({ pendingAction }),
  reset: () => set({ ...INITIAL_STATE }),
}));
