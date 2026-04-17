import { create } from 'zustand';
import type { backend } from '@/lib/desktop/models';

export type DebloatListFilter = backend.DebloatList | 'All';
export type RemovalFilter = backend.RemovalTier | 'All';
export type StateFilter = backend.PkgState | 'All';

interface DebloatState {
  // ── Data ─────────────────────────────────────────────────────────────────
  packages: backend.DebloatPackageRow[];
  listStatus: backend.DebloatListStatus | null;
  isLoadingPackages: boolean;
  isApplying: boolean;

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery: string;
  listFilter: DebloatListFilter;
  removalFilter: RemovalFilter;
  stateFilter: StateFilter;

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedPackages: Set<string>;
  /** Currently highlighted package for the description panel */
  currentPackageName: string | null;

  // ── Settings (synced with per-device backend settings) ────────────────────
  expertMode: boolean;
  disableMode: boolean;
  multiUserMode: boolean;

  // ── Backups ───────────────────────────────────────────────────────────────
  backups: backend.BackupSummary[];
  selectedBackupFileName: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setPackages: (packages: backend.DebloatPackageRow[]) => void;
  setListStatus: (status: backend.DebloatListStatus | null) => void;
  setIsLoadingPackages: (loading: boolean) => void;
  setIsApplying: (applying: boolean) => void;

  setSearchQuery: (q: string) => void;
  setListFilter: (f: DebloatListFilter) => void;
  setRemovalFilter: (f: RemovalFilter) => void;
  setStateFilter: (f: StateFilter) => void;

  togglePackage: (name: string) => void;
  selectAll: () => void;
  unselectAll: () => void;
  setCurrentPackageName: (name: string | null) => void;

  setExpertMode: (v: boolean) => void;
  setDisableMode: (v: boolean) => void;
  setMultiUserMode: (v: boolean) => void;

  setBackups: (backups: backend.BackupSummary[]) => void;
  setSelectedBackupFileName: (name: string | null) => void;

  /** Update states of packages after a batch action. */
  applyResults: (results: backend.DebloatActionResult[]) => void;

  /** Reset all filters and selection. */
  resetFilters: () => void;
}

export const useDebloatStore = create<DebloatState>((set, get) => ({
  packages: [],
  listStatus: null,
  isLoadingPackages: false,
  isApplying: false,

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

  setPackages: (packages) => set({ packages }),
  setListStatus: (listStatus) => set({ listStatus }),
  setIsLoadingPackages: (isLoadingPackages) => set({ isLoadingPackages }),
  setIsApplying: (isApplying) => set({ isApplying }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setListFilter: (listFilter) => set({ listFilter }),
  setRemovalFilter: (removalFilter) => set({ removalFilter }),
  setStateFilter: (stateFilter) => set({ stateFilter }),

  togglePackage: (name) => {
    const { selectedPackages, packages, expertMode } = get();
    const pkg = packages.find((p) => p.name === name);
    // Block Unsafe selection without expert mode
    if (pkg?.removal === 'Unsafe' && !expertMode) return;
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
    const next = new Set(
      filtered.filter((p) => expertMode || p.removal !== 'Unsafe').map((p) => p.name),
    );
    set({ selectedPackages: next });
  },

  unselectAll: () => set({ selectedPackages: new Set() }),

  setCurrentPackageName: (currentPackageName) => set({ currentPackageName }),

  setExpertMode: (expertMode) => {
    // Deselect any Unsafe packages if expert mode is turned off
    if (!expertMode) {
      const { selectedPackages, packages } = get();
      const unsafeNames = new Set(
        packages.filter((p) => p.removal === 'Unsafe').map((p) => p.name),
      );
      const next = new Set([...selectedPackages].filter((n) => !unsafeNames.has(n)));
      set({ expertMode, selectedPackages: next });
    } else {
      set({ expertMode });
    }
  },

  setDisableMode: (disableMode) => set({ disableMode }),
  setMultiUserMode: (multiUserMode) => set({ multiUserMode }),

  setBackups: (backups) => set({ backups }),
  setSelectedBackupFileName: (selectedBackupFileName) => set({ selectedBackupFileName }),

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
    const successNames = new Set(results.filter((r) => r.success).map((r) => r.packageName));
    const { selectedPackages } = get();
    const next = new Set([...selectedPackages].filter((n) => !successNames.has(n)));
    set({ packages: updated, selectedPackages: next });
  },

  resetFilters: () =>
    set({ searchQuery: '', listFilter: 'All', removalFilter: 'All', stateFilter: 'All' }),
}));

// ── Client-side filter helper (used by components + selectAll) ────────────────

interface FilterOptions {
  listFilter: DebloatListFilter;
  removalFilter: RemovalFilter;
  stateFilter: StateFilter;
  searchQuery: string;
}

export function applyFilters(
  packages: backend.DebloatPackageRow[],
  { listFilter, removalFilter, stateFilter, searchQuery }: FilterOptions,
): backend.DebloatPackageRow[] {
  const q = searchQuery.toLowerCase().trim();
  return packages.filter((p) => {
    if (listFilter !== 'All' && p.list !== listFilter) return false;
    if (removalFilter !== 'All' && p.removal !== removalFilter) return false;
    if (stateFilter !== 'All' && p.state !== stateFilter) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q))
      return false;
    return true;
  });
}
