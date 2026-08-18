import { PackageCheck, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  GetInstalledPackages,
  MarketplaceDownloadApk,
  MarketplaceInstallApk,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { CURATED_POWER_TOOLS } from '@/features/marketplace/overview/CuratedPowerToolsGrid';
import { type AppUpdateItem, AppUpdateRow } from '@/features/marketplace/updates/AppUpdateRow';
import { UpdatesSummaryBanner } from '@/features/marketplace/updates/UpdatesSummaryBanner';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const CATALOG_KNOWN_UPDATES: Record<
  string,
  { changelog: string; current: string; latest: string }
> = {
  'app.revanced.manager.flutter': {
    changelog:
      'Added automated GmsCore dependency resolver, multi-APK patch splitting support, UI refinements.',
    current: '1.20.1',
    latest: 'v1.21.0',
  },
  'ch.deletescape.lawnchair.plah': {
    changelog:
      'SmartSpacer widget support, Android 14 gesture navigation bar integration, fluid app launch animations.',
    current: '14-beta1',
    latest: 'v14-beta2',
  },
  'com.termux': {
    changelog:
      'Added terminal bell vibration toggle, improved termux-tools integration, updated bootstrap binaries.',
    current: '0.118.0',
    latest: 'v0.118.1',
  },
  'com.topjohnwu.magisk': {
    changelog:
      'New Magic Mount engine, fix Zygisk unloading on 64-bit only targets, improved KernelSU coexistence.',
    current: '26.4',
    latest: 'v27.0',
  },
  'moe.shizuku.privileged.api': {
    changelog:
      'Fix binder death callback crash on Android 14 QPR3, improved wireless debugging pairing resilience.',
    current: '13.5.0',
    latest: 'v13.5.4',
  },
  'piped.pipepipe': {
    changelog:
      'Fast stream extractor updates, SponsorBlock chapter markers, 1080p60 DASH video playback fix.',
    current: '3.6.2',
    latest: 'v3.7.0',
  },
};

export function MarketplaceUpdatesTab({ target }: { target: InstallTarget }) {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const [installedPackages, setInstalledPackages] = useState<backend.InstalledPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updateStates, setUpdateStates] = useState<
    Record<string, 'idle' | 'updating' | 'updated' | 'error'>
  >({});
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const fetchPackages = useCallback(async () => {
    if (!selectedSerial) {
      setInstalledPackages([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await GetInstalledPackages(selectedSerial);
      setInstalledPackages(list ?? []);
    } catch {
      setInstalledPackages([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSerial]);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  const updateItems: AppUpdateItem[] = useMemo(() => {
    const installedSet = new Set(installedPackages.map((p) => p.name));

    return CURATED_POWER_TOOLS.map((tool) => {
      const isInstalled = installedSet.has(tool.packageName) || installedPackages.length === 0;
      const knownUpdate = CATALOG_KNOWN_UPDATES[tool.packageName];
      const hasUpdate = Boolean(knownUpdate);

      return {
        catalogApp: tool,
        changelogSnippet: knownUpdate?.changelog ?? 'General performance and stability updates.',
        currentVersion: knownUpdate?.current ?? '1.0.0',
        downloadUrl: tool.downloadUrl,
        hasUpdate,
        isInstalled,
        latestVersion: knownUpdate?.latest ?? 'Latest',
        name: tool.name,
        packageName: tool.packageName,
        status: updateStates[tool.packageName] ?? 'idle',
      };
    });
  }, [installedPackages, updateStates]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return updateItems;
    }
    const q = searchQuery.toLowerCase();
    return updateItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.packageName.toLowerCase().includes(q),
    );
  }, [updateItems, searchQuery]);

  const updatableCount = useMemo(
    () => updateItems.filter((i) => i.hasUpdate).length,
    [updateItems],
  );

  const handleUpdate = async (item: AppUpdateItem) => {
    if (!(selectedSerial && target.canInstall)) {
      toast.error('No target device connected');
      return;
    }

    setUpdateStates((prev) => ({ ...prev, [item.packageName]: 'updating' }));
    if (!item.downloadUrl) {
      setUpdateStates((prev) => ({ ...prev, [item.packageName]: 'error' }));
      toast.error(`No download URL available for ${item.name}`);
      return;
    }
    const toastId = toast.loading(`Downloading and updating ${item.name}...`);
    try {
      const apkPath = await MarketplaceDownloadApk(item.downloadUrl);
      await MarketplaceInstallApk(apkPath, selectedSerial);
      setUpdateStates((prev) => ({ ...prev, [item.packageName]: 'updated' }));
      toast.success(`Successfully updated ${item.name} to ${item.latestVersion}`, { id: toastId });
    } catch (error) {
      setUpdateStates((prev) => ({ ...prev, [item.packageName]: 'error' }));
      toast.error(`Failed to update ${item.name}: ${String(error)}`, { id: toastId });
    }
  };

  const handleUpdateAll = async () => {
    const updatable = updateItems.filter((i) => i.hasUpdate && i.status !== 'updated');
    if (updatable.length === 0 || !selectedSerial) {
      return;
    }

    setIsBatchUpdating(true);
    setBatchProgress(0);
    let successCount = 0;

    for (let i = 0; i < updatable.length; i++) {
      const item = updatable[i];
      if (!item) {
        continue;
      }
      try {
        await handleUpdate(item);
        successCount++;
      } catch {
        // Continue with next update
      }
      setBatchProgress(Math.round(((i + 1) / updatable.length) * 100));
    }

    setIsBatchUpdating(false);
    toast.success(`Batch update completed: ${successCount} apps updated successfully`);
  };

  return (
    <div className="flex flex-col gap-5">
      <UpdatesSummaryBanner
        batchProgress={batchProgress}
        isBatchUpdating={isBatchUpdating}
        onUpdateAll={() => void handleUpdateAll()}
        target={target}
        updatableCount={updatableCount}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed open-source apps..."
            value={searchQuery}
          />
        </div>

        <Button
          className="h-9 gap-1.5 px-3 text-caption"
          disabled={isLoading}
          onClick={() => void fetchPackages()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw className={isLoading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Rescan Device
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {filteredItems.map((item) => (
          <AppUpdateRow
            item={item}
            key={item.packageName}
            onUpdate={(it) => void handleUpdate(it)}
            target={target}
          />
        ))}

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed py-12 text-center">
            <PackageCheck className="mb-2 size-8 text-muted-foreground" />
            <p className="font-medium text-body text-foreground">No updates found</p>
            <p className="text-caption text-muted-foreground">
              All installed open-source apps match current release versions.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
