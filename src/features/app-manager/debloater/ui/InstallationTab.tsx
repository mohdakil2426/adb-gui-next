/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer } from 'react';
import { toast } from 'sonner';
import {
  GetInstalledPackages,
  InstallPackage,
  SelectMultipleApkFiles,
  UninstallPackage,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { ApkPickerPanel } from '@/features/app-manager/debloater/ui/ApkPickerPanel';
import { InstalledPackageList } from '@/features/app-manager/debloater/ui/InstalledPackageList';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/formatting';
import { invalidatePackages } from '@/shared/utils/queries';

type State = {
  apkPaths: string[];
  isInstalling: boolean;
  installProgress: { current: number; total: number } | null;
  packages: backend.InstalledPackage[];
  isLoadingPackages: boolean;
  selectedPackages: Set<string>;
  searchQuery: string;
  packageFilter: 'all' | 'user' | 'system';
  isUninstalling: boolean;
};

type Action =
  | { type: 'SET_APK_PATHS'; payload: string[] }
  | { type: 'SET_IS_INSTALLING'; payload: boolean }
  | { type: 'SET_INSTALL_PROGRESS'; payload: { current: number; total: number } | null }
  | { type: 'SET_PACKAGES'; payload: backend.InstalledPackage[] }
  | { type: 'SET_IS_LOADING_PACKAGES'; payload: boolean }
  | { type: 'SET_SELECTED_PACKAGES'; payload: Set<string> }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_PACKAGE_FILTER'; payload: 'all' | 'user' | 'system' }
  | { type: 'SET_IS_UNINSTALLING'; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_APK_PATHS':
      return { ...state, apkPaths: action.payload };
    case 'SET_IS_INSTALLING':
      return { ...state, isInstalling: action.payload };
    case 'SET_INSTALL_PROGRESS':
      return { ...state, installProgress: action.payload };
    case 'SET_PACKAGES':
      return { ...state, packages: action.payload };
    case 'SET_IS_LOADING_PACKAGES':
      return { ...state, isLoadingPackages: action.payload };
    case 'SET_SELECTED_PACKAGES':
      return { ...state, selectedPackages: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_PACKAGE_FILTER':
      return { ...state, packageFilter: action.payload };
    case 'SET_IS_UNINSTALLING':
      return { ...state, isUninstalling: action.payload };
    default:
      return state;
  }
}

const initialState: State = {
  apkPaths: [],
  isInstalling: false,
  installProgress: null,
  packages: [],
  isLoadingPackages: false,
  selectedPackages: new Set(),
  searchQuery: '',
  packageFilter: 'all',
  isUninstalling: false,
};

export function InstallationTab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();

  const loadPackages = useCallback(async () => {
    if (!selectedSerial) {
      dispatch({ type: 'SET_PACKAGES', payload: [] });
      return;
    }
    dispatch({ type: 'SET_IS_LOADING_PACKAGES', payload: true });
    try {
      const list = await GetInstalledPackages(selectedSerial);
      dispatch({ type: 'SET_PACKAGES', payload: list ?? [] });
    } catch (error) {
      handleError('Load Packages', error);
    } finally {
      dispatch({ type: 'SET_IS_LOADING_PACKAGES', payload: false });
    }
  }, [selectedSerial]);

  useEffect(() => {
    dispatch({ type: 'SET_SELECTED_PACKAGES', payload: new Set() });
    void loadPackages();
  }, [loadPackages]);

  async function handleSelectApk() {
    try {
      const paths = await SelectMultipleApkFiles();
      if (paths?.length) {
        dispatch({ type: 'SET_APK_PATHS', payload: paths });
        toast.info(`${paths.length} file(s) selected`);
      }
    } catch (error) {
      handleError('Select APK Files', error);
    }
  }

  async function handleInstall() {
    if (!selectedSerial) {
      return;
    }
    if (state.apkPaths.length === 0) {
      return;
    }
    dispatch({ type: 'SET_IS_INSTALLING', payload: true });
    dispatch({
      type: 'SET_INSTALL_PROGRESS',
      payload: { current: 0, total: state.apkPaths.length },
    });
    const toastId = toast.loading('Starting installation...');
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < state.apkPaths.length; i++) {
      const path = state.apkPaths[i];
      if (!path) {
        continue;
      }
      const name = getFileName(path);
      toast.loading(`Installing (${i + 1}/${state.apkPaths.length}): ${name}`, {
        id: toastId,
      });
      dispatch({
        type: 'SET_INSTALL_PROGRESS',
        payload: { current: i + 1, total: state.apkPaths.length },
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        await InstallPackage(path, selectedSerial ?? '');
        ok++;
        useLogStore.getState().addLog(`Installed APK: ${name}`, 'success');
      } catch (error) {
        useLogStore.getState().addLog(`Failed to install ${name}: ${error}`, 'error');
        fail++;
      }
    }
    if (fail === 0) {
      toast.success(`Successfully installed ${ok} APK(s)`, { id: toastId });
    } else {
      toast.warning(`Finished: ${ok} installed, ${fail} failed`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
    }
    dispatch({ type: 'SET_APK_PATHS', payload: [] });
    dispatch({ type: 'SET_IS_INSTALLING', payload: false });
    dispatch({ type: 'SET_INSTALL_PROGRESS', payload: null });
  }

  async function handleUninstall() {
    if (!selectedSerial) {
      return;
    }
    if (state.selectedPackages.size === 0) {
      return;
    }
    dispatch({ type: 'SET_IS_UNINSTALLING', payload: true });
    const list = Array.from(state.selectedPackages);
    const toastId = toast.loading(`Uninstalling ${list.length} package(s)...`);
    let ok = 0;
    let fail = 0;
    for (const pkg of list) {
      toast.loading(`Uninstalling: ${pkg}...`, { id: toastId });
      try {
        const output = await UninstallPackage(pkg, selectedSerial);
        useLogStore.getState().addLog(`Uninstalled: ${pkg}: ${output}`, 'success');
        ok++;
      } catch (error) {
        useLogStore.getState().addLog(`Failed to uninstall ${pkg}: ${error}`, 'error');
        fail++;
      }
    }
    if (fail === 0) {
      toast.success(`Successfully uninstalled ${ok} package(s)`, {
        id: toastId,
      });
    } else {
      toast.warning(`Finished: ${ok} uninstalled, ${fail} failed`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
    }
    dispatch({ type: 'SET_SELECTED_PACKAGES', payload: new Set() });
    await loadPackages();
    dispatch({ type: 'SET_IS_UNINSTALLING', payload: false });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Install APK section */}
      <ApkPickerPanel
        apkPaths={state.apkPaths}
        installProgress={state.installProgress}
        isInstalling={state.isInstalling}
        onAddMore={() => {
          void handleSelectApk();
        }}
        onClearAll={() => {
          dispatch({ type: 'SET_APK_PATHS', payload: [] });
        }}
        onInstall={() => {
          void handleInstall();
        }}
        onPathsChange={(paths) => {
          dispatch({ type: 'SET_APK_PATHS', payload: paths });
        }}
        selectedSerial={selectedSerial}
      />

      <div className="border-t" />

      {/* Uninstall section */}
      <InstalledPackageList
        isLoadingPackages={state.isLoadingPackages}
        isUninstalling={state.isUninstalling}
        onPackageFilterChange={(filter) => {
          dispatch({ type: 'SET_PACKAGE_FILTER', payload: filter });
        }}
        onRefresh={() => {
          void loadPackages();
        }}
        onSearchQueryChange={(query) => {
          dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
        }}
        onSelectedPackagesChange={(pkgs) => {
          dispatch({ type: 'SET_SELECTED_PACKAGES', payload: pkgs });
        }}
        onUninstall={() => {
          void handleUninstall();
        }}
        packageFilter={state.packageFilter}
        packages={state.packages}
        searchQuery={state.searchQuery}
        selectedPackages={state.selectedPackages}
        selectedSerial={selectedSerial}
      />
    </div>
  );
}
