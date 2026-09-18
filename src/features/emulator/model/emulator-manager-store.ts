import { create } from "zustand";

import type { backend } from "@/desktop/models";
import { DEFAULT_LAUNCH_OPTIONS } from "@/features/emulator/model/launch-options";
import type {
  LaunchAcknowledgements,
  LaunchOptionKey,
} from "@/features/emulator/model/launch-options";

export type EmulatorManagerTab = "overview" | "launch" | "root" | "restore";
export type EmulatorPendingAction = "launch" | "stop" | "restore" | "refreshPlan" | null;

/** Wizard step for the root flow. */
export type RootWizardStep = "preflight" | "setup" | "progress" | "result";

/** Describes where the Magisk package will come from. */
export type RootWizardSource = { type: "stable" } | { type: "local"; path: string } | null;

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
  setupTab: "autopilot" | "manual";
  source: RootWizardSource;
  step: RootWizardStep;
  verification: backend.RootVerificationResult | null;
}

const INITIAL_MANUAL_STATE: RootManualState = {
  error: null,
  finalizeResult: null,
  isFinalizing: false,
  isPreparing: false,
  packagePath: null,
  patchedImagePath: null,
  prepareResult: null,
};

const INITIAL_ROOT_WIZARD: RootWizardState = {
  error: null,
  isVerifying: false,
  manualState: INITIAL_MANUAL_STATE,
  preflightScan: null,
  progress: null,
  result: null,
  setupTab: "autopilot",
  source: null,
  step: "preflight",
  verification: null,
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
  setSetupTab: (tab: "autopilot" | "manual") => void;
  updateManualState: (state: Partial<RootManualState>) => void;
}

const INITIAL_STATE = {
  activeTab: "overview" as EmulatorManagerTab,
  launchAcknowledgements: {} as LaunchAcknowledgements,
  launchOptions: DEFAULT_LAUNCH_OPTIONS,
  pendingAction: null as EmulatorPendingAction,
  restorePlan: null as backend.RestorePlan | null,
  rootWizard: INITIAL_ROOT_WIZARD,
  selectedAvdName: null,
};

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  ...INITIAL_STATE,

  applyLaunchPreset: (launchOptions) => {
    set({ launchAcknowledgements: {}, launchOptions });
  },
  reset: () => {
    set({ ...INITIAL_STATE });
  },
  resetManualState: () => {
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        manualState: INITIAL_MANUAL_STATE,
      },
    }));
  },
  resetRootWizard: () => {
    set({ rootWizard: INITIAL_ROOT_WIZARD });
  },
  setActiveTab: (activeTab) => {
    set({ activeTab });
  },
  setLaunchAcknowledged: (key, acknowledged) => {
    set((state) => ({
      launchAcknowledgements: {
        ...state.launchAcknowledgements,
        [key]: acknowledged,
      },
    }));
  },
  setLaunchOption: (key, value) => {
    set((state) => ({
      // Turning a destructive flag off retires its tick, so re-enabling it asks again.
      launchAcknowledgements: value
        ? state.launchAcknowledgements
        : { ...state.launchAcknowledgements, [key]: false },
      launchOptions: { ...state.launchOptions, [key]: value },
    }));
  },
  setPendingAction: (pendingAction) => {
    set({ pendingAction });
  },
  setPreflightScan: (preflightScan) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, preflightScan } }));
  },
  setRestorePlan: (restorePlan) => {
    set({ restorePlan });
  },
  setRootVerification: (verification) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, verification } }));
  },
  setRootVerifying: (isVerifying) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, isVerifying } }));
  },
  setRootWizardProgress: (progress) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, progress } }));
  },
  setRootWizardResult: (result, error = null) => {
    set((state) => ({
      rootWizard: {
        ...state.rootWizard,
        error,
        isVerifying: false,
        result,
        step: "result",
        verification: null,
      },
    }));
  },
  setRootWizardSource: (source) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, source } }));
  },
  setRootWizardStep: (step) => {
    set((state) => ({ rootWizard: { ...state.rootWizard, step } }));
  },
  setSelectedAvdName: (selectedAvdName) => {
    set({ selectedAvdName });
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
}));
