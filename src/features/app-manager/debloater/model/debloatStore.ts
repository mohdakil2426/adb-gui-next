import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { backend } from '@/desktop/models';

export type AppManagerTab = 'debloater' | 'installation';
export type DebloatListFilter = backend.DebloatList | 'All';
export type RemovalFilter = backend.RemovalTier | 'All';
export type StateFilter = backend.PkgState | 'All';

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

export const useDebloatStore = create<DebloatState>()(
  persist(
    (set, get): DebloatState => ({
      packages: [],
      listStatus: null,
      isLoadingPackages: false,
      isApplying: false,

      activeTab: 'installation',

      searchQuery: '',
      listFilter: 'All',
      removalFilter: 'All',
      stateFilter: 'All',

      selectedPackages: new Set(),
      currentPackageName: null,

      expertMode: false,
      disableMode: false,
      multiUserMode: false,

      backups: [],
      selectedBackupFileName: null,

      setPackages: (packages) => {
        set({ packages });
      },
      setListStatus: (listStatus) => {
        set({ listStatus });
      },
      setIsLoadingPackages: (isLoadingPackages) => {
        set({ isLoadingPackages });
      },
      setIsApplying: (isApplying) => {
        set({ isApplying });
      },

      setSearchQuery: (searchQuery) => {
        set({ searchQuery });
      },
      setListFilter: (listFilter) => {
        set({ listFilter });
      },
      setRemovalFilter: (removalFilter) => {
        set({ removalFilter });
      },
      setStateFilter: (stateFilter) => {
        set({ stateFilter });
      },

      togglePackage: (name) => {
        const { selectedPackages, packages, expertMode } = get();
        const pkg = packages.find((p) => p.name === name);
        // Block Unsafe selection without expert mode
        if (pkg?.removal === 'Unsafe' && !expertMode) {
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

      selectAll: () => {
        const { packages, expertMode, listFilter, removalFilter, stateFilter, searchQuery } = get();
        const filtered = applyFilters(packages, {
          listFilter,
          removalFilter,
          stateFilter,
          searchQuery,
        });
        const next = new Set<string>();
        for (const p of filtered) {
          if (expertMode || p.removal !== 'Unsafe') {
            next.add(p.name);
          }
        }
        set({ selectedPackages: next });
      },

      unselectAll: () => {
        set({ selectedPackages: new Set() });
      },

      setCurrentPackageName: (currentPackageName) => {
        set({ currentPackageName });
      },

      setActiveTab: (activeTab) => {
        set({ activeTab });
      },

      setExpertMode: (expertMode) => {
        // Deselect any Unsafe packages if expert mode is turned off
        if (expertMode) {
          set({ expertMode });
        } else {
          const { selectedPackages, packages } = get();
          const unsafeNames = new Set<string>();
          for (const p of packages) {
            if (p.removal === 'Unsafe') {
              unsafeNames.add(p.name);
            }
          }
          const next = new Set([...selectedPackages].filter((n) => !unsafeNames.has(n)));
          set({ expertMode, selectedPackages: next });
        }
      },

      setDisableMode: (disableMode) => {
        set({ disableMode });
      },
      setMultiUserMode: (multiUserMode) => {
        set({ multiUserMode });
      },

      setBackups: (backups) => {
        set({ backups });
      },
      setSelectedBackupFileName: (selectedBackupFileName) => {
        set({ selectedBackupFileName });
      },

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

      resetFilters: () => {
        set({
          searchQuery: '',
          listFilter: 'All',
          removalFilter: 'All',
          stateFilter: 'All',
        });
      },
    }),
    {
      name: 'debloat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTab: state.activeTab,
        searchQuery: state.searchQuery,
        listFilter: state.listFilter,
        removalFilter: state.removalFilter,
        stateFilter: state.stateFilter,
        expertMode: state.expertMode,
        disableMode: state.disableMode,
      }),
    },
  ),
);

// ── Client-side filter helper (used by components + selectAll) ────────────────

interface FilterOptions {
  listFilter: DebloatListFilter;
  removalFilter: RemovalFilter;
  searchQuery: string;
  stateFilter: StateFilter;
}

export function applyFilters(
  packages: backend.DebloatPackageRow[],
  { listFilter, removalFilter, stateFilter, searchQuery }: FilterOptions,
): backend.DebloatPackageRow[] {
  const q = searchQuery.toLowerCase().trim();
  return packages.filter((p) => {
    if (listFilter !== 'All' && p.list !== listFilter) {
      return false;
    }
    if (removalFilter !== 'All' && p.removal !== removalFilter) {
      return false;
    }
    if (stateFilter !== 'All' && p.state !== stateFilter) {
      return false;
    }
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
