import { create } from 'zustand';
import type { backend } from '@/desktop/models';
import {
  DEFAULT_LAUNCH_OPTIONS,
  type LaunchAcknowledgements,
  type LaunchOptionKey,
} from '@/features/emulator/model/launchOptions';

export type EmulatorManagerTab = 'launch' | 'root' | 'restore';
export type EmulatorPendingAction = 'launch' | 'stop' | 'restore' | 'refreshPlan' | null;

/** Wizard step for the root flow. */
export type RootWizardStep = 'preflight' | 'setup' | 'progress' | 'result';

/** Describes where the Magisk package will come from. */
export type RootWizardSource = { type: 'stable' } | { type: 'local'; path: string } | null;

export interface RootManualState {
  error: string | null;
  finalizeResult: backend.RootFinalizeResult | null;
  isFinalizing: boolean;
  isPreparing: boolean;
  packagePath: string | null;
  patchedImagePath: string | null;
  prepareResult: backend.RootPreparationResult | null;
}

export interface RootWizardState {
  error: string | null;
  isVerifying: boolean;
  manualState: RootManualState;
  preflightScan: backend.RootReadinessScan | null;
  progress: backend.RootProgress | null;
  result: backend.RootAvdResult | null;
  setupTab: 'autopilot' | 'manual';
  source: RootWizardSource;
  step: RootWizardStep;
  verification: backend.RootVerificationResult | null;
}

const INITIAL_MANUAL_STATE: RootManualState = {
  packagePath: null,
  patchedImagePath: null,
  prepareResult: null,
  finalizeResult: null,
  error: null,
  isPreparing: false,
  isFinalizing: false,
};

const INITIAL_ROOT_WIZARD: RootWizardState = {
  step: 'preflight',
  setupTab: 'autopilot',
  source: null,
  progress: null,
  result: null,
  verification: null,
  isVerifying: false,
  error: null,
  preflightScan: null,
  manualState: INITIAL_MANUAL_STATE,
};

interface EmulatorManagerState {
  activeTab: EmulatorManagerTab;
  /** Replaces every flag at once (presets) and clears acknowledgements. */
  applyLaunchPreset: (options: backend.EmulatorLaunchOptions) => void;
  launchAcknowledgements: LaunchAcknowledgements;
  /**
   * The single source of truth for how the selected AVD is launched. The
   * toolbar's Launch button and the Launch tab both read this object, so the
   * toolbar can no longer discard flags the user just set.
   */
  launchOptions: backend.EmulatorLaunchOptions;
  pendingAction: EmulatorPendingAction;
  reset: () => void;
  resetManualState: () => void;
  resetRootWizard: () => void;
  restorePlan: backend.RestorePlan | null;
  rootWizard: RootWizardState;
  selectedAvdName: string | null;
  setActiveTab: (tab: EmulatorManagerTab) => void;
  setLaunchAcknowledged: (key: LaunchOptionKey, acknowledged: boolean) => void;
  setLaunchOption: (key: LaunchOptionKey, value: boolean) => void;
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
  setSetupTab: (tab: 'autopilot' | 'manual') => void;
  updateManualState: (state: Partial<RootManualState>) => void;
}

const INITIAL_STATE = {
  selectedAvdName: null,
  activeTab: 'launch' as EmulatorManagerTab,
  rootWizard: INITIAL_ROOT_WIZARD,
  restorePlan: null as backend.RestorePlan | null,
  pendingAction: null as EmulatorPendingAction,
  launchOptions: DEFAULT_LAUNCH_OPTIONS,
  launchAcknowledgements: {} as LaunchAcknowledgements,
};

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  ...INITIAL_STATE,

  setSelectedAvdName: (selectedAvdName) => {
    set({ selectedAvdName });
  },
  setActiveTab: (activeTab) => {
    set({ activeTab });
  },

  setLaunchOption: (key, value) => {
    set((state) => ({
      launchOptions: { ...state.launchOptions, [key]: value },
      // Turning a destructive flag off retires its tick, so re-enabling it asks again.
      launchAcknowledgements: value
        ? state.launchAcknowledgements
        : { ...state.launchAcknowledgements, [key]: false },
    }));
  },

  setLaunchAcknowledged: (key, acknowledged) => {
    set((state) => ({
      launchAcknowledgements: { ...state.launchAcknowledgements, [key]: acknowledged },
    }));
  },

  applyLaunchPreset: (launchOptions) => {
    set({ launchOptions, launchAcknowledgements: {} });
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

  setSetupTab: (setupTab) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, setupTab } }));
  },

  updateManualState: (manualState) => {
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        manualState: { ...state.rootWizard.manualState, ...manualState },
      },
    }));
  },

  resetManualState: () => {
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        manualState: INITIAL_MANUAL_STATE,
      },
    }));
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
