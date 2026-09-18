import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { backend } from "@/desktop/models";
// Empty state handled across UI when data?.length === 0

/**
 * Three jobs, three tabs. `installation` (install APKs) and `installed`
 * (browse / uninstall what is on the device) used to share one tab separated by
 * a bare rule; `installation` keeps its old value so a persisted tab still resolves.
 */
export type AppManagerTab = "overview" | "installed" | "installation" | "debloater";
export type DebloatListFilter = backend.DebloatList | "All";
export type RemovalFilter = backend.RemovalTier | "All";
export type StateFilter = backend.PkgState | "All";

interface DebloatState {
  // ── UI State ────────────────────────────────────────────────────────────────
  activeTab: AppManagerTab;

  /** Update states of packages after a batch action. */
  applyResults: (results: backend.DebloatActionResult[]) => void;

  // ── Backups ───────────────────────────────────────────────────────────────
  backups: backend.BackupSummary[];
  /** Currently highlighted package for the description panel */
  currentPackageName: string | null;
  disableMode: boolean;

  // ── Settings (synced with per-device backend settings) ────────────────────
  expertMode: boolean;
  isApplying: boolean;
  isLoadingPackages: boolean;
  listFilter: DebloatListFilter;
  listStatus: backend.DebloatListStatus | null;
  multiUserMode: boolean;
  // ── Data ─────────────────────────────────────────────────────────────────
  packages: backend.DebloatPackageRow[];
  removalFilter: RemovalFilter;

  /** Reset all filters and selection. */
  resetFilters: () => void;

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery: string;
  selectAll: () => void;
  selectedBackupFileName: string | null;

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedPackages: Set<string>;
  setActiveTab: (tab: AppManagerTab) => void;

  setBackups: (backups: backend.BackupSummary[]) => void;
  setCurrentPackageName: (name: string | null) => void;
  setDisableMode: (v: boolean) => void;

  setExpertMode: (v: boolean) => void;
  setIsApplying: (applying: boolean) => void;
  setIsLoadingPackages: (loading: boolean) => void;
  setListFilter: (f: DebloatListFilter) => void;
  setListStatus: (status: backend.DebloatListStatus | null) => void;
  setMultiUserMode: (v: boolean) => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  setPackages: (packages: backend.DebloatPackageRow[]) => void;
  setRemovalFilter: (f: RemovalFilter) => void;

  setSearchQuery: (q: string) => void;
  setSelectedBackupFileName: (name: string | null) => void;
  setStateFilter: (f: StateFilter) => void;
  stateFilter: StateFilter;

  togglePackage: (name: string) => void;
  unselectAll: () => void;
}
// ── Client-side filter helper (used by components + selectAll) ────────────────

interface FilterOptions {
  listFilter: DebloatListFilter;
  removalFilter: RemovalFilter;
  searchQuery: string;
  stateFilter: StateFilter;
}

export const applyFilters = (
  packages: backend.DebloatPackageRow[],
  { listFilter, removalFilter, stateFilter, searchQuery }: FilterOptions
): backend.DebloatPackageRow[] => {
  const q = searchQuery.toLowerCase().trim();
  return packages.filter((p) => {
    if (listFilter !== "All" && p.list !== listFilter) {
      return false;
    }
    if (removalFilter !== "All" && p.removal !== removalFilter) {
      return false;
    }
    if (stateFilter !== "All" && p.state !== stateFilter) {
      return false;
    }
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
};

export const useDebloatStore = create<DebloatState>()(
  persist(
    (set, get): DebloatState => ({
      activeTab: "installation",
      applyResults: (results) => {
        const { packages } = get();
        const resultMap = new Map(results.map((r) => [r.packageName, r]));
        const updated = packages.map((p) => {
          const result = resultMap.get(p.name);
          if (result?.success) {
            return { ...p, state: result.newState };
          }
          return p;
        });
        // Deselect successfully acted packages
        const successNames = new Set<string>();
        for (const r of results) {
          if (r.success) {
            successNames.add(r.packageName);
          }
        }
        const { selectedPackages } = get();
        const next = new Set([...selectedPackages].filter((n) => !successNames.has(n)));
        set({ packages: updated, selectedPackages: next });
      },
      backups: [],
      currentPackageName: null,
      disableMode: false,
      expertMode: false,
      isApplying: false,
      isLoadingPackages: false,
      listFilter: "All",
      listStatus: null,
      multiUserMode: false,
      packages: [],
      removalFilter: "All",
      resetFilters: () => {
        set({
          listFilter: "All",
          removalFilter: "All",
          searchQuery: "",
          stateFilter: "All",
        });
      },
      searchQuery: "",
      selectAll: () => {
        const { packages, expertMode, listFilter, removalFilter, stateFilter, searchQuery } = get();
        const filtered = applyFilters(packages, {
          listFilter,
          removalFilter,
          searchQuery,
          stateFilter,
        });
        const next = new Set<string>();
        for (const p of filtered) {
          if (expertMode || p.removal !== "Unsafe") {
            next.add(p.name);
          }
        }
        set({ selectedPackages: next });
      },
      selectedBackupFileName: null,
      selectedPackages: new Set(),
      setActiveTab: (activeTab) => {
        set({ activeTab });
      },
      setBackups: (backups) => {
        set({ backups });
      },
      setCurrentPackageName: (currentPackageName) => {
        set({ currentPackageName });
      },
      setDisableMode: (disableMode) => {
        set({ disableMode });
      },
      setExpertMode: (expertMode) => {
        // Deselect any Unsafe packages if expert mode is turned off
        if (expertMode) {
          set({ expertMode });
        } else {
          const { selectedPackages, packages } = get();
          const unsafeNames = new Set<string>();
          for (const p of packages) {
            if (p.removal === "Unsafe") {
              unsafeNames.add(p.name);
            }
          }
          const next = new Set([...selectedPackages].filter((n) => !unsafeNames.has(n)));
          set({ expertMode, selectedPackages: next });
        }
      },
      setIsApplying: (isApplying) => {
        set({ isApplying });
      },
      setIsLoadingPackages: (isLoadingPackages) => {
        set({ isLoadingPackages });
      },
      setListFilter: (listFilter) => {
        set({ listFilter });
      },
      setListStatus: (listStatus) => {
        set({ listStatus });
      },
      setMultiUserMode: (multiUserMode) => {
        set({ multiUserMode });
      },
      setPackages: (packages) => {
        set({ packages });
      },
      setRemovalFilter: (removalFilter) => {
        set({ removalFilter });
      },
      setSearchQuery: (searchQuery) => {
        set({ searchQuery });
      },
      setSelectedBackupFileName: (selectedBackupFileName) => {
        set({ selectedBackupFileName });
      },
      setStateFilter: (stateFilter) => {
        set({ stateFilter });
      },
      stateFilter: "All",
      togglePackage: (name) => {
        const { selectedPackages, packages, expertMode } = get();
        const pkg = packages.find((p) => p.name === name);
        // Block Unsafe selection without expert mode
        if (pkg?.removal === "Unsafe" && !expertMode) {
          return;
        }
        const next = new Set(selectedPackages);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        set({ selectedPackages: next });
      },
      unselectAll: () => {
        set({ selectedPackages: new Set() });
      },
    }),
    {
      name: "debloat-storage",
      partialize: (state) => ({
        activeTab: state.activeTab,
        disableMode: state.disableMode,
        expertMode: state.expertMode,
        listFilter: state.listFilter,
        removalFilter: state.removalFilter,
        searchQuery: state.searchQuery,
        stateFilter: state.stateFilter,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
