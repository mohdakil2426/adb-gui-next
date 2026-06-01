import { create } from 'zustand';
import type { backend } from '@/desktop/models';

interface InstallationState {
  apkPaths: string[];
  installProgress: { current: number; total: number } | null;
  isInstalling: boolean;
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  loadedSerial: string | null;
  packageFilter: 'all' | 'user' | 'system';
  packages: backend.InstalledPackage[];
  resetStore: () => void;
  searchQuery: string;
  selectedPackages: Set<string>;

  setApkPaths: (paths: string[]) => void;
  setInstallProgress: (p: { current: number; total: number } | null) => void;
  setIsInstalling: (v: boolean) => void;
  setIsLoadingPackages: (v: boolean) => void;
  setIsUninstalling: (v: boolean) => void;
  setLoadedSerial: (serial: string | null) => void;
  setPackageFilter: (f: 'all' | 'user' | 'system') => void;
  setPackages: (pkgs: backend.InstalledPackage[]) => void;
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

  setApkPaths: (apkPaths) => set({ apkPaths }),
  setIsInstalling: (isInstalling) => set({ isInstalling }),
  setInstallProgress: (installProgress) => set({ installProgress }),
  setPackages: (packages) => set({ packages }),
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
    }),
}));
