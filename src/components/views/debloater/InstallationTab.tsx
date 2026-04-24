/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button-variants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandInput } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { DropZone } from '@/components/DropZone';
import { SelectionSummaryBar } from '@/components/SelectionSummaryBar';
import {
  SelectMultipleApkFiles,
  InstallPackage,
  UninstallPackage,
  GetInstalledPackages,
} from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';
import { getFileName } from '@/lib/utils';
import { Filter, FileUp, Loader2, Package, RefreshCw, Trash2 } from 'lucide-react';
import type { backend } from '@/lib/desktop/models';

export function InstallationTab() {
  // ── Install state ─────────────────────────────────────────────────────────
  const [apkPaths, setApkPaths] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // ── Uninstall state ───────────────────────────────────────────────────────
  const [packages, setPackages] = useState<backend.InstalledPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState<'all' | 'user' | 'system'>('all');
  const [isUninstalling, setIsUninstalling] = useState(false);

  const loadPackages = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      const list = await GetInstalledPackages();
      setPackages(list ?? []);
    } catch (error) {
      handleError('Load Packages', error);
    } finally {
      setIsLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const filteredPackages = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return packages
      .filter((pkg) => {
        if (packageFilter !== 'all' && pkg.packageType !== packageFilter) return false;
        return pkg.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aSelected = selectedPackages.has(a.name);
        const bSelected = selectedPackages.has(b.name);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
  }, [packages, searchQuery, selectedPackages, packageFilter]);

  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    getScrollElement: () => listRef.current,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    estimateSize: () => 36,
    overscan: 5,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  function togglePackage(name: string) {
    setSelectedPackages((curr) => {
      const next = new Set(curr);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSelectApk() {
    try {
      const paths = await SelectMultipleApkFiles();
      if (paths?.length) {
        setApkPaths(paths);
        toast.info(`${paths.length} file(s) selected`);
      }
    } catch (error) {
      handleError('Select APK Files', error);
    }
  }

  async function handleInstall() {
    if (apkPaths.length === 0) return;
    setIsInstalling(true);
    setInstallProgress({ current: 0, total: apkPaths.length });
    const toastId = toast.loading('Starting installation…');
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < apkPaths.length; i++) {
      const path = apkPaths[i];
      const name = getFileName(path);
      toast.loading(`Installing (${i + 1}/${apkPaths.length}): ${name}`, { id: toastId });
      setInstallProgress({ current: i + 1, total: apkPaths.length });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        await InstallPackage(path);
        ok++;
        useLogStore.getState().addLog(`Installed APK: ${name}`, 'success');
      } catch (error) {
        useLogStore.getState().addLog(`Failed to install ${name}: ${error}`, 'error');
        fail++;
      }
    }
    if (fail === 0) toast.success(`Successfully installed ${ok} APK(s)`, { id: toastId });
    else toast.warning(`Finished: ${ok} installed, ${fail} failed`, { id: toastId });
    setApkPaths([]);
    setIsInstalling(false);
    setInstallProgress(null);
  }

  async function handleUninstall() {
    if (selectedPackages.size === 0) return;
    setIsUninstalling(true);
    const list = Array.from(selectedPackages);
    const toastId = toast.loading(`Uninstalling ${list.length} package(s)…`);
    let ok = 0;
    let fail = 0;
    for (const pkg of list) {
      toast.loading(`Uninstalling: ${pkg}…`, { id: toastId });
      try {
        const output = await UninstallPackage(pkg);
        useLogStore.getState().addLog(`Uninstalled: ${pkg}: ${output}`, 'success');
        ok++;
      } catch (error) {
        useLogStore.getState().addLog(`Failed to uninstall ${pkg}: ${error}`, 'error');
        fail++;
      }
    }
    if (fail === 0) toast.success(`Successfully uninstalled ${ok} package(s)`, { id: toastId });
    else toast.warning(`Finished: ${ok} uninstalled, ${fail} failed`, { id: toastId });
    setSelectedPackages(new Set());
    await loadPackages();
    setIsUninstalling(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Install APK section ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Install APK</p>
          <p className="text-xs text-muted-foreground">
            Select .apk or .apks files to install on your device.
          </p>
        </div>

        {apkPaths.length === 0 ? (
          <DropZone
            onFilesDropped={(paths) => {
              setApkPaths((prev) => [...prev, ...paths]);
              toast.info(`${paths.length} file(s) added`);
            }}
            onBrowse={handleSelectApk}
            acceptExtensions={['.apk', '.apks']}
            rejectMessage="Only .apk and .apks files are accepted"
            icon={FileUp}
            label="Drop APK files here"
            browseLabel="Select App Files"
            sublabel="Accepts .apk and .apks files"
            disabled={isInstalling}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Label>Selected APKs</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleSelectApk}
                disabled={isInstalling}
              >
                <FileUp className="size-3.5" />
                Add More
              </Button>
            </div>

            <div className="rounded-lg border shadow-sm overflow-hidden bg-popover">
              <div className="max-h-[30vh] min-h-24 overflow-y-auto p-1">
                {apkPaths.map((path) => (
                  <div
                    key={path}
                    className="group flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 mr-2">
                      <Package className="size-4 shrink-0 opacity-70" />
                      <span className="truncate">{path.split(/[/\\]/).pop()}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-transparent"
                      onClick={() => setApkPaths((prev) => prev.filter((p) => p !== path))}
                      disabled={isInstalling}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <SelectionSummaryBar
              count={apkPaths.length}
              label="file(s)"
              onClear={() => setApkPaths([])}
              disabled={isInstalling}
            />

            <Button
              className="relative w-full overflow-hidden"
              disabled={isInstalling}
              onClick={() => void handleInstall()}
            >
              {isInstalling && installProgress && (
                <div
                  className="absolute inset-0 left-0 bg-primary/20 transition-all duration-300"
                  style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
                />
              )}
              <span className="relative z-10 flex items-center">
                {isInstalling ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Package className="mr-2 size-4" />
                )}
                {isInstalling
                  ? `Installing ${installProgress?.current}/${installProgress?.total}…`
                  : `Install (${apkPaths.length})`}
              </span>
            </Button>
          </>
        )}
      </div>

      <div className="border-t" />

      {/* ── Uninstall section ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Uninstall Package</p>
            <p className="text-xs text-muted-foreground">
              {isLoadingPackages
                ? 'Loading…'
                : `${filteredPackages.length} of ${packages.length} packages`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Filter className="size-3.5" />
                  {packageFilter === 'all' ? 'All' : `${packageFilter}`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={packageFilter}
                  onValueChange={(v) => setPackageFilter(v as 'all' | 'user' | 'system')}
                >
                  <DropdownMenuRadioItem value="all">All ({packages.length})</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="user">
                    User ({packages.filter((p) => p.packageType === 'user').length})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    System ({packages.filter((p) => p.packageType === 'system').length})
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => void loadPackages()}
              disabled={isLoadingPackages}
            >
              {isLoadingPackages ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <Command shouldFilter={false} className="rounded-lg border shadow-sm overflow-hidden">
          <CommandInput
            placeholder="Search packages…"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <div
            ref={listRef}
            className="h-[40vh] min-h-60 overflow-y-auto overflow-x-hidden"
            role="listbox"
            aria-label="Installed packages"
            aria-multiselectable="true"
          >
            {filteredPackages.length === 0 ? (
              <CommandEmpty>
                {searchQuery ? 'No packages match your search.' : 'No packages found.'}
              </CommandEmpty>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualRows.map((vRow) => {
                  const pkg = filteredPackages[vRow.index];
                  const isSelected = selectedPackages.has(pkg.name);
                  return (
                    <div
                      key={pkg.name}
                      onClick={() => togglePackage(pkg.name)}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          togglePackage(pkg.name);
                        }
                      }}
                      className={cn(
                        'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-accent text-accent-foreground',
                      )}
                      style={{
                        height: `${vRow.size}px`,
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    >
                      <CheckboxItem checked={isSelected} />
                      <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border bg-muted/40 shrink-0">
                        <Package className="size-3.5 text-muted-foreground" />
                      </div>
                      <span className="flex-1 truncate text-xs">{pkg.name}</span>
                      <Badge
                        variant={pkg.packageType === 'user' ? 'secondary' : 'outline'}
                        className="ml-2 shrink-0 px-1.5 py-0 text-[10px]"
                      >
                        {pkg.packageType}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Command>

        <SelectionSummaryBar
          count={selectedPackages.size}
          label="package(s)"
          onClear={() => setSelectedPackages(new Set())}
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full"
              disabled={isUninstalling || selectedPackages.size === 0}
            >
              <Trash2 className="mr-2 size-4" />
              Uninstall
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>
                    You are about to uninstall{' '}
                    <span className="font-semibold text-foreground">{selectedPackages.size}</span>{' '}
                    package(s).
                  </p>
                  <div className="mt-2 max-h-24 overflow-y-auto rounded bg-muted p-2 text-xs">
                    {Array.from(selectedPackages).map((p) => (
                      <div key={p} className="truncate">
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-warning/20 bg-warning/10 p-3 text-left text-xs text-warning-foreground">
                    <span className="font-bold">Disclaimer:</span> ADB GUI Next is not responsible
                    for any system instability, bootloops, or data loss resulting from uninstalling
                    packages.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={() => void handleUninstall()}
                disabled={isUninstalling}
              >
                {isUninstalling ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Yes, Uninstall
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
