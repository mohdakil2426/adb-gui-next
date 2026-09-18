import { create } from "zustand";

import type { backend } from "@/desktop/models";

/**
 * Batch install progress.
 *
 * `adb install` reports nothing until a file finishes, so the only honest
 * determinate value is *files completed*. `currentFile` and `startedAt` exist so
 * the UI can prove the run is alive while a single large APK is in flight —
 * previously a 400 MB APK showed a frozen "Installing 1/1…" for minutes.
 */
export interface InstallProgress {
  completed: number;
  currentFile: string | null;
  startedAt: number;
  total: number;
}
export type InstalledPackageFilter = "all" | "user" | "system" | "disabled";
export type InstalledSortBy = "name" | "package" | "size" | "targetSdk";
export type SortOrder = "asc" | "desc";

export const DEFAULT_INSTALL_FLAGS: backend.InstallFlagsConfig = {
  allowDowngrade: false,
  allowTestPackages: false,
  bypassLowTargetSdk: false,
  grantPermissions: false,
  reinstall: true,
  userId: "",
};

export const buildAdbInstallFlags = (flags: backend.InstallFlagsConfig): string[] => {
  const args: string[] = [];
  if (flags.reinstall) {
    args.push("-r");
  }
  if (flags.allowDowngrade) {
    args.push("-d");
  }
  if (flags.grantPermissions) {
    args.push("-g");
  }
  if (flags.allowTestPackages) {
    args.push("-t");
  }
  if (flags.bypassLowTargetSdk) {
    args.push("--bypass-low-target-sdk-block");
  }
  if (flags.userId.trim()) {
    args.push("--user", flags.userId.trim());
  }
  return args;
};

export interface ItemInstallStatus {
  durationMs?: number;
  error?: string;
  status: "queued" | "installing" | "completed" | "failed";
}

interface InstallationState {
  apkPaths: string[];
  clearInspections: () => void;
  clearItemStatuses: () => void;
  inspections: Record<string, backend.ApkInspectionResult>;
  installFlags: backend.InstallFlagsConfig;
  installProgress: InstallProgress | null;
  isInstalling: boolean;
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  itemStatuses: Record<string, ItemInstallStatus>;
  loadedSerial: string | null;
  packageFilter: InstalledPackageFilter;
  packages: backend.InstalledPackage[];
  /** Why the last `pm list packages` failed, or `null`. Distinguishes "no apps" from "could not ask". */
  packagesError: string | null;
  resetInstallFlags: () => void;
  resetStore: () => void;
  searchQuery: string;
  selectedPackages: Set<string>;

  setApkPaths: (paths: string[]) => void;
  setInspection: (path: string, result: backend.ApkInspectionResult) => void;
  setInstallFlags: (flags: Partial<backend.InstallFlagsConfig>) => void;
  setInstallProgress: (p: InstallProgress | null) => void;
  setIsInstalling: (v: boolean) => void;
  setIsLoadingPackages: (v: boolean) => void;
  setIsUninstalling: (v: boolean) => void;
  setItemStatus: (path: string, status: ItemInstallStatus) => void;
  setLoadedSerial: (serial: string | null) => void;
  setPackageFilter: (f: InstalledPackageFilter) => void;
  setPackages: (pkgs: backend.InstalledPackage[]) => void;
  setPackagesError: (message: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSelectedPackages: (pkgs: Set<string>) => void;
  setSortBy: (sortBy: InstalledSortBy) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  sortBy: InstalledSortBy;
  sortOrder: SortOrder;
}

export const useInstallationStore = create<InstallationState>((set) => ({
  apkPaths: [],
  clearInspections: () => set({ inspections: {} }),
  clearItemStatuses: () => set({ itemStatuses: {} }),
  inspections: {},
  installFlags: DEFAULT_INSTALL_FLAGS,
  installProgress: null,
  isInstalling: false,
  isLoadingPackages: false,
  isUninstalling: false,
  itemStatuses: {},
  loadedSerial: null,
  packageFilter: "all",
  packages: [],
  packagesError: null,
  resetInstallFlags: () => set({ installFlags: DEFAULT_INSTALL_FLAGS }),
  resetStore: () =>
    set({
      apkPaths: [],
      inspections: {},
      installFlags: DEFAULT_INSTALL_FLAGS,
      installProgress: null,
      isInstalling: false,
      isLoadingPackages: false,
      isUninstalling: false,
      itemStatuses: {},
      loadedSerial: null,
      packageFilter: "all",
      packages: [],
      packagesError: null,
      searchQuery: "",
      selectedPackages: new Set(),
      sortBy: "name",
      sortOrder: "asc",
    }),
  searchQuery: "",
  selectedPackages: new Set(),
  setApkPaths: (apkPaths) => set({ apkPaths }),
  setInspection: (path, result) =>
    set((state) => ({ inspections: { ...state.inspections, [path]: result } })),
  setInstallFlags: (flags) =>
    set((state) => ({ installFlags: { ...state.installFlags, ...flags } })),
  setInstallProgress: (installProgress) => set({ installProgress }),
  setIsInstalling: (isInstalling) => set({ isInstalling }),
  setIsLoadingPackages: (isLoadingPackages) => set({ isLoadingPackages }),
  setIsUninstalling: (isUninstalling) => set({ isUninstalling }),
  setItemStatus: (path, status) =>
    set((state) => ({
      itemStatuses: { ...state.itemStatuses, [path]: status },
    })),
  setLoadedSerial: (loadedSerial) => set({ loadedSerial }),
  setPackageFilter: (packageFilter) => set({ packageFilter }),
  setPackages: (packages) => set({ packages }),
  setPackagesError: (packagesError) => set({ packagesError }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedPackages: (selectedPackages) => set({ selectedPackages }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  sortBy: "name",
  sortOrder: "asc",
}));
