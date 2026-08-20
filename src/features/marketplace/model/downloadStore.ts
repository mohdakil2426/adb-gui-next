import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';

export interface DownloadProgress {
  bytesDownloaded: number;
  downloadId: string;
  etaSeconds: number | null;
  packageName: string;
  percentage: number;
  speedBps: number;
  totalBytes: number | null;
}

interface DownloadStoreState {
  activeDownloads: Record<string, DownloadProgress>;
  clearDownload: (packageName: string) => void;
  setDownloadProgress: (progress: DownloadProgress) => void;
}

export const useMarketplaceDownloadStore = create<DownloadStoreState>((set) => ({
  activeDownloads: {},
  clearDownload: (packageName) =>
    set((state) => {
      const next = { ...state.activeDownloads };
      delete next[packageName];
      return { activeDownloads: next };
    }),
  setDownloadProgress: (progress) =>
    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [progress.packageName]: progress,
      },
    })),
}));

if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  try {
    void listen<DownloadProgress>('marketplace:download-progress', (event) => {
      if (event.payload?.packageName) {
        useMarketplaceDownloadStore.getState().setDownloadProgress(event.payload);
        if (event.payload.percentage >= 100) {
          setTimeout(() => {
            useMarketplaceDownloadStore.getState().clearDownload(event.payload.packageName);
          }, 2000);
        }
      }
    });
  } catch {
    // Ignore in non-Tauri / test environments
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) {
    return '';
  }
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1000) {
    return `${(megabytes / 1024).toFixed(1)} GB`;
  }
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }
  const kilobytes = bytes / 1024;
  return `${kilobytes.toFixed(0)} KB`;
}

export function formatSpeed(speedBps: number | null | undefined): string {
  if (speedBps == null || speedBps <= 0) {
    return '';
  }
  const mbps = speedBps / (1024 * 1024);
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} MB/s`;
  }
  const kbps = speedBps / 1024;
  return `${kbps.toFixed(0)} KB/s`;
}
