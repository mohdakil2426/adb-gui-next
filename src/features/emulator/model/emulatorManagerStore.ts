import { create } from 'zustand';
import type { backend } from '@/desktop/models';

export type EmulatorManagerTab = 'overview' | 'launch' | 'root' | 'restore';
export type EmulatorPendingAction = 'launch' | 'stop' | 'restore' | 'refreshPlan' | null;

/** Wizard step for the root flow. */
export type RootWizardStep = 'preflight' | 'setup' | 'progress' | 'result';

/** Describes where the Magisk package will come from. */
export type RootWizardSource = { type: 'stable' } | { type: 'local'; path: string } | null;

export interface RootWizardState {
  error: string | null;
  isVerifying: boolean;
  preflightScan: backend.RootReadinessScan | null;
  progress: backend.RootProgress | null;
  result: backend.RootAvdResult | null;
  source: RootWizardSource;
  step: RootWizardStep;
  verification: backend.RootVerificationResult | null;
}

const INITIAL_ROOT_WIZARD: RootWizardState = {
  step: 'preflight',
  source: null,
  progress: null,
  result: null,
  verification: null,
  isVerifying: false,
  error: null,
  preflightScan: null,
};

interface EmulatorManagerState {
  activeTab: EmulatorManagerTab;
  pendingAction: EmulatorPendingAction;
  reset: () => void;
  resetRootWizard: () => void;
  restorePlan: backend.RestorePlan | null;
  rootWizard: RootWizardState;
  selectedAvdName: string | null;
  setActiveTab: (tab: EmulatorManagerTab) => void;
  setPendingAction: (action: EmulatorPendingAction) => void;
  setPreflightScan: (scan: backend.RootReadinessScan | null) => void;
  setRestorePlan: (plan: backend.RestorePlan | null) => void;
  setRootVerification: (verification: backend.RootVerificationResult | null) => void;
  setRootVerifying: (isVerifying: boolean) => void;
  setRootWizardProgress: (progress: backend.RootProgress | null) => void;
  setRootWizardResult: (result: backend.RootAvdResult | null, error?: string | null) => void;
  setRootWizardSource: (source: RootWizardSource) => void;
  setRootWizardStep: (step: RootWizardStep) => void;
  setSelectedAvdName: (name: string | null) => void;
}

const INITIAL_STATE = {
  selectedAvdName: null,
  activeTab: 'overview' as EmulatorManagerTab,
  rootWizard: INITIAL_ROOT_WIZARD,
  restorePlan: null as backend.RestorePlan | null,
  pendingAction: null as EmulatorPendingAction,
};

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  ...INITIAL_STATE,

  setSelectedAvdName: (selectedAvdName) => {
    set({ selectedAvdName });
  },
  setActiveTab: (activeTab) => {
    set({ activeTab });
  },

  setRootWizardStep: (step) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, step } }));
  },

  setRootWizardSource: (source) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, source } }));
  },

  setRootWizardProgress: (progress) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, progress } }));
  },

  setRootWizardResult: (result, error = null) => {
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        result,
        verification: null,
        isVerifying: false,
        error,
        step: 'result',
      },
    }));
  },

  setRootVerification: (verification) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, verification } }));
  },

  setRootVerifying: (isVerifying) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, isVerifying } }));
  },

  setPreflightScan: (preflightScan) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, preflightScan } }));
  },

  resetRootWizard: () => {
    set({ rootWizard: INITIAL_ROOT_WIZARD });
  },

  setRestorePlan: (restorePlan) => {
    set({ restorePlan });
  },
  setPendingAction: (pendingAction) => {
    set({ pendingAction });
  },
  reset: () => {
    set({ ...INITIAL_STATE });
  },
}));
