import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogStore } from '@/lib/logStore';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';

import {
  SelectMultipleApkFiles,
  InstallPackage,
  UninstallPackage,
  GetInstalledPackages,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { Loader2, Package, Trash2, FileUp, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SelectionSummaryBar } from '@/components/SelectionSummaryBar';
import { getFileName } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { DropZone } from '@/components/DropZone';

export function ViewAppManager({ activeView }: { activeView: string }) {
  const [apkPaths, setApkPaths] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const [packages, setPackages] = useState<backend.InstalledPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState<'all' | 'user' | 'system'>('all');

  const [isUninstalling, setIsUninstalling] = useState(false);

  const loadPackages = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      debugLog('Loading installed packages');
      const packageList = await GetInstalledPackages();
      setPackages(packageList || []);
      debugLog('Loaded packages:', packageList);
    } catch (error) {
      handleError('Load Packages', error);
    } finally {
      setIsLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'apps') {
      loadPackages();
    }
  }, [activeView, loadPackages]);

  const filteredPackages = useMemo(() => {
    const normalizedSearchQuery = searchQuery.toLowerCase();

    return packages
      .filter((pkg) => {
        if (packageFilter !== 'all' && pkg.packageType !== packageFilter) return false;
        return pkg.name.toLowerCase().includes(normalizedSearchQuery);
      })
      .sort((a, b) => {
        const aSelected = selectedPackages.has(a.name);
        const bSelected = selectedPackages.has(b.name);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
  }, [packages, searchQuery, selectedPackages, packageFilter]);

  const packageListRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    getScrollElement: () => packageListRef.current,
    estimateSize: () => 36,
    overscan: 5,
  });

  const handleSelectApk = async () => {
    try {
      debugLog('Selecting APK files');
      const selectedPaths = await SelectMultipleApkFiles();
      if (selectedPaths && selectedPaths.length > 0) {
        setApkPaths(selectedPaths);
        toast.info(`${selectedPaths.length} file(s) selected`);
        debugLog('Selected APK files:', selectedPaths);
      }
    } catch (error) {
      handleError('Select APK Files', error);
    }
  };

  const handleInstall = async () => {
    if (apkPaths.length === 0) {
      toast.error('No APK files selected.');
      return;
    }

    setIsInstalling(true);
    setInstallProgress({ current: 0, total: apkPaths.length });

    const toastId = toast.loading('Starting installation...');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < apkPaths.length; i++) {
      const path = apkPaths[i];
      const fileName = getFileName(path);

      toast.loading(`Installing (${i + 1}/${apkPaths.length}): ${fileName}`, { id: toastId });
      setInstallProgress({ current: i + 1, total: apkPaths.length });

      try {
        await InstallPackage(path);
        successCount++;
        useLogStore.getState().addLog(`Installed APK: ${fileName}`, 'success');
      } catch (error) {
        console.error(`Failed to install ${fileName}:`, error);
        useLogStore.getState().addLog(`Failed to install ${fileName}: ${error}`, 'error');
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success(`Successfully installed ${successCount} APK(s)`, { id: toastId });
    } else {
      toast.warning(`Finished: ${successCount} installed, ${failCount} failed`, { id: toastId });
    }

    setApkPaths([]);
    setIsInstalling(false);
    setInstallProgress(null);
  };

  const togglePackage = (packageName: string) => {
    setSelectedPackages((current) => {
      const next = new Set(current);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  const handleUninstall = async () => {
    if (selectedPackages.size === 0) {
      toast.error('No packages selected.');
      return;
    }

    setIsUninstalling(true);
    const packageList = Array.from(selectedPackages);
    const toastId = toast.loading(`Uninstalling ${packageList.length} package(s)...`);

    let successCount = 0;
    let failCount = 0;

    for (const pkg of packageList) {
      toast.loading(`Uninstalling: ${pkg}...`, { id: toastId });
      try {
        const output = await UninstallPackage(pkg);
        useLogStore.getState().addLog(`Uninstalled package: ${pkg}: ${output}`, 'success');
        successCount++;
      } catch (error) {
        console.error(`Failed to uninstall ${pkg}:`, error);
        useLogStore.getState().addLog(`Failed to uninstall ${pkg}: ${error}`, 'error');
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success(`Successfully uninstalled ${successCount} package(s)`, { id: toastId });
    } else {
      toast.warning(`Finished: ${successCount} uninstalled, ${failCount} failed`, { id: toastId });
    }

    setSelectedPackages(new Set());
    await loadPackages();
    setIsUninstalling(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Install APK
          </CardTitle>
          <CardDescription>
            Select .apk or .apks files from your computer to install them on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {apkPaths.length === 0 ? (
            /* Empty state — show drop zone */
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
            /* Files selected — show list + install */
            <>
              <div className="flex items-center justify-between">
                <Label>Selected APK</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleSelectApk}
                  disabled={isInstalling}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Add More
                </Button>
              </div>

              <div className="rounded-lg border shadow-md bg-popover text-popover-foreground overflow-hidden">
                <div className="max-h-75 overflow-y-auto p-1">
                  {apkPaths.map((path, idx) => (
                    <div
                      key={idx}
                      className="group relative flex items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex items-center min-w-0 flex-1 mr-2">
                        <Package className="mr-2 h-4 w-4 opacity-70 shrink-0" />
                        <span className="truncate">{path.split(/[/\\]/).pop()}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-transparent"
                        onClick={() => {
                          const newPaths = [...apkPaths];
                          newPaths.splice(idx, 1);
                          setApkPaths(newPaths);
                        }}
                        disabled={isInstalling}
                      >
                        <Trash2 className="h-3 w-3" />
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
                variant="default"
                className="w-full relative overflow-hidden"
                disabled={isInstalling}
                onClick={handleInstall}
              >
                {isInstalling && installProgress && (
                  <div
                    className="absolute inset-0 bg-primary/20 transition-all duration-300 left-0"
                    style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
                  />
                )}

                <span className="relative z-10 flex items-center">
                  {isInstalling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Package className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  {isInstalling
                    ? `Installing ${installProgress?.current}/${installProgress?.total}...`
                    : `Install (${apkPaths.length})`}
                </span>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Uninstall Package
          </CardTitle>
          <CardDescription>
            Search and select a package to uninstall it from your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {/* Package count — left side */}
            <div className="text-sm text-muted-foreground">
              {isLoadingPackages
                ? 'Loading...'
                : `${filteredPackages.length} of ${packages.length} packages`}
            </div>

            {/* Filter + Refresh — right side */}
            <div className="flex items-center gap-2 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="capitalize">
                      {packageFilter === 'all' ? 'All Packages' : `${packageFilter} Apps`}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={packageFilter}
                    onValueChange={(value) => setPackageFilter(value as 'all' | 'user' | 'system')}
                  >
                    <DropdownMenuRadioItem value="all">
                      All ({packages.length})
                    </DropdownMenuRadioItem>
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
                onClick={loadPackages}
                disabled={isLoadingPackages}
              >
                {isLoadingPackages ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* Command: shadcn component with shouldFilter=false (we filter via useMemo) */}
            <Command
              shouldFilter={false}
              className="rounded-lg border shadow-md overflow-hidden"
            >
              <CommandInput
                placeholder="Search packages..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              {/* Virtualizer scroll container — must be a plain div so the ref works */}
              <div
                ref={packageListRef}
                className="h-75 overflow-y-auto"
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
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const pkg = filteredPackages[virtualRow.index];
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
                            'absolute left-0 w-full flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                            isSelected && 'bg-accent text-accent-foreground',
                          )}
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <CheckboxItem checked={isSelected} />
                          <Package className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate flex-1">{pkg.name}</span>
                          <Badge
                            variant={pkg.packageType === 'user' ? 'secondary' : 'outline'}
                            className="ml-2 shrink-0 text-[10px] px-1.5 py-0"
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
          </div>

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
                <Trash2 className="mr-2 h-4 w-4" />
                Uninstall
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to uninstall{' '}
                  <span className="font-semibold text-foreground">{selectedPackages.size}</span>{' '}
                  package(s).
                  <br />
                  <div className="mt-2 max-h-25 overflow-y-auto text-xs bg-muted p-2 rounded">
                    {Array.from(selectedPackages).map((p) => (
                      <div key={p} className="truncate">
                        {p}
                      </div>
                    ))}
                  </div>
                  <br />
                  This action cannot be undone.
                  <div className="mt-4 p-3 border border-warning/20 bg-warning/10 rounded-md text-warning-foreground text-xs text-left">
                    <span className="font-bold">Disclaimer:</span> ADB GUI Next is not responsible
                    for any system instability, bootloops, or data loss resulting from uninstalling
                    packages. Please verify that these packages are safe to remove.
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: 'destructive' })}
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                >
                  {isUninstalling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  Yes, Uninstall
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
