import { PackageCheck, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  MarketplaceCheckUpdates,
  MarketplaceDownloadApk,
  MarketplaceInstallApk,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { type AppUpdateItem, AppUpdateRow } from '@/features/marketplace/updates/AppUpdateRow';
import { UpdatesSummaryBanner } from '@/features/marketplace/updates/UpdatesSummaryBanner';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { runSerial } from '@/shared/utils/serialAsync';

export function MarketplaceUpdatesTab({ target }: { target: InstallTarget }) {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const [candidates, setCandidates] = useState<backend.AppUpdateCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updateStates, setUpdateStates] = useState<
    Record<string, 'idle' | 'updating' | 'updated' | 'error'>
  >({});
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const fetchUpdates = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await MarketplaceCheckUpdates(selectedSerial);
      setCandidates(list ?? []);
    } catch {
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSerial]);

  useEffect(() => {
    void fetchUpdates();
  }, [fetchUpdates]);

  const updateItems: AppUpdateItem[] = useMemo(
    () =>
      candidates.map((cand) => ({
        name: cand.appName,
        packageName: cand.packageName,
        currentVersion: cand.currentVersion,
        latestVersion: cand.latestVersion,
        source: cand.source,
        downloadUrl: cand.downloadUrl,
        changelogSnippet:
          cand.changelog || cand.changelogSnippet || 'General performance and stability updates.',
        hasUpdate: cand.hasUpdate,
        isInstalled: true,
        status: updateStates[cand.packageName] ?? 'idle',
      })),
    [candidates, updateStates],
  );

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
      // packageName keys the throttled download-progress events, which is what
      // feeds the per-row progress strip while the APK streams in.
      const apkPath = await MarketplaceDownloadApk(item.downloadUrl, item.packageName);
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
    try {
      await runSerial(updatable, async (item, i) => {
        try {
          await handleUpdate(item);
          successCount++;
        } catch {
          // Continue with next update
        }
        setBatchProgress(Math.round(((i + 1) / updatable.length) * 100));
      });
      toast.success(`Batch update completed: ${successCount} apps updated successfully`);
    } finally {
      setIsBatchUpdating(false);
    }
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
            aria-label="Search installed open-source apps"
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed open-source apps..."
            value={searchQuery}
          />
        </div>

        <Button
          className="h-9 gap-1.5 px-3 text-caption"
          disabled={isLoading}
          onClick={() => void fetchUpdates()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw
            aria-hidden="true"
            className={isLoading ? 'size-3.5 animate-spin' : 'size-3.5'}
            data-icon="inline-start"
          />
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
