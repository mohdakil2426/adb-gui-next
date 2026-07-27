import { create } from 'zustand';
import type { backend } from '@/desktop/models';

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

interface InstallationState {
  apkPaths: string[];
  installProgress: InstallProgress | null;
  isInstalling: boolean;
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  loadedSerial: string | null;
  packageFilter: 'all' | 'user' | 'system';
  packages: backend.InstalledPackage[];
  /** Why the last `pm list packages` failed, or `null`. Distinguishes "no apps" from "could not ask". */
  packagesError: string | null;
  resetStore: () => void;
  searchQuery: string;
  selectedPackages: Set<string>;

  setApkPaths: (paths: string[]) => void;
  setInstallProgress: (p: InstallProgress | null) => void;
  setIsInstalling: (v: boolean) => void;
  setIsLoadingPackages: (v: boolean) => void;
  setIsUninstalling: (v: boolean) => void;
  setLoadedSerial: (serial: string | null) => void;
  setPackageFilter: (f: 'all' | 'user' | 'system') => void;
  setPackages: (pkgs: backend.InstalledPackage[]) => void;
  setPackagesError: (message: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSelectedPackages: (pkgs: Set<string>) => void;
}

export const useInstallationStore = create<InstallationState>((set) => ({
  apkPaths: [],
  isInstalling: false,
  installProgress: null,
  packages: [],
  isLoadingPackages: false,
  selectedPackages: new Set(),
  searchQuery: '',
  packageFilter: 'all',
  isUninstalling: false,
  loadedSerial: null,
  packagesError: null,

  setApkPaths: (apkPaths) => set({ apkPaths }),
  setIsInstalling: (isInstalling) => set({ isInstalling }),
  setInstallProgress: (installProgress) => set({ installProgress }),
  setPackages: (packages) => set({ packages }),
  setPackagesError: (packagesError) => set({ packagesError }),
  setIsLoadingPackages: (isLoadingPackages) => set({ isLoadingPackages }),
  setSelectedPackages: (selectedPackages) => set({ selectedPackages }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPackageFilter: (packageFilter) => set({ packageFilter }),
  setIsUninstalling: (isUninstalling) => set({ isUninstalling }),
  setLoadedSerial: (loadedSerial) => set({ loadedSerial }),
  resetStore: () =>
    set({
      apkPaths: [],
      isInstalling: false,
      installProgress: null,
      packages: [],
      isLoadingPackages: false,
      selectedPackages: new Set(),
      searchQuery: '',
      packageFilter: 'all',
      isUninstalling: false,
      loadedSerial: null,
      packagesError: null,
    }),
}));
