import { create } from 'zustand';
import type { backend } from '@/lib/desktop/models';

export type EmulatorManagerTab = 'overview' | 'launch' | 'root' | 'restore';
export type EmulatorPendingAction = 'launch' | 'stop' | 'restore' | 'refreshPlan' | null;

/** Wizard step for the automated root flow. */
export type RootWizardStep = 'preflight' | 'source' | 'progress' | 'result';

/** Describes where the Magisk package will come from. */
export type RootWizardSource = { type: 'stable' } | { type: 'local'; path: string } | null;

export interface RootWizardState {
  step: RootWizardStep;
  source: RootWizardSource;
  progress: backend.RootProgress | null;
  result: backend.RootAvdResult | null;
  verification: backend.RootVerificationResult | null;
  isVerifying: boolean;
  error: string | null;
  preflightScan: backend.RootReadinessScan | null;
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
  selectedAvdName: string | null;
  activeTab: EmulatorManagerTab;
  rootWizard: RootWizardState;
  restorePlan: backend.RestorePlan | null;
  pendingAction: EmulatorPendingAction;
  setSelectedAvdName: (name: string | null) => void;
  setActiveTab: (tab: EmulatorManagerTab) => void;
  setRootWizardStep: (step: RootWizardStep) => void;
  setRootWizardSource: (source: RootWizardSource) => void;
  setRootWizardProgress: (progress: backend.RootProgress | null) => void;
  setRootWizardResult: (result: backend.RootAvdResult | null, error?: string | null) => void;
  setRootVerification: (verification: backend.RootVerificationResult | null) => void;
  setRootVerifying: (isVerifying: boolean) => void;
  setPreflightScan: (scan: backend.RootReadinessScan | null) => void;
  resetRootWizard: () => void;
  setRestorePlan: (plan: backend.RestorePlan | null) => void;
  setPendingAction: (action: EmulatorPendingAction) => void;
  reset: () => void;
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

  setSelectedAvdName: (selectedAvdName) => set({ selectedAvdName }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setRootWizardStep: (step) => set((state) => ({ rootWizard: { ...state.rootWizard, step } })),

  setRootWizardSource: (source) =>
    set((state) => ({ rootWizard: { ...state.rootWizard, source } })),

  setRootWizardProgress: (progress) =>
    set((state) => ({ rootWizard: { ...state.rootWizard, progress } })),

  setRootWizardResult: (result, error = null) =>
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        result,
        verification: null,
        isVerifying: false,
        error,
        step: 'result',
      },
    })),

  setRootVerification: (verification) =>
    set((state) => ({ rootWizard: { ...state.rootWizard, verification } })),

  setRootVerifying: (isVerifying) =>
    set((state) => ({ rootWizard: { ...state.rootWizard, isVerifying } })),

  setPreflightScan: (preflightScan) =>
    set((state) => ({ rootWizard: { ...state.rootWizard, preflightScan } })),

  resetRootWizard: () => set({ rootWizard: INITIAL_ROOT_WIZARD }),

  setRestorePlan: (restorePlan) => set({ restorePlan }),
  setPendingAction: (pendingAction) => set({ pendingAction }),
  reset: () => set({ ...INITIAL_STATE }),
}));
