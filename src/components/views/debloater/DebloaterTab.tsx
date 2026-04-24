/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { CheckSquare2, Filter, Loader2, RefreshCcw, Search, Shield, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { useDebloatStore, applyFilters } from '@/lib/debloatStore';
import type { DebloatListFilter, RemovalFilter, StateFilter } from '@/lib/debloatStore';
import type { backend } from '@/lib/desktop/models';
import {
  GetDebloatPackages,
  LoadDebloatLists,
  DebloatPackages,
  GetDebloatDeviceSettings,
  SaveDebloatDeviceSettings,
  ListDebloatBackups,
} from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';
import { DescriptionPanel } from './DescriptionPanel';
import { ReviewSelectionDialog } from './ReviewSelectionDialog';
import { REMOVAL_TIER_CLASSES, REMOVAL_TIER_LABELS, PKG_STATE_CLASSES } from './debloaterUtils';

const LIST_OPTIONS: Array<{ value: DebloatListFilter; label: string }> = [
  { value: 'All', label: 'All Lists' },
  { value: 'Aosp', label: 'AOSP' },
  { value: 'Google', label: 'Google' },
  { value: 'Oem', label: 'OEM' },
  { value: 'Carrier', label: 'Carrier' },
  { value: 'Misc', label: 'Misc' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Unlisted', label: 'Unlisted' },
];

const REMOVAL_OPTIONS: Array<{ value: RemovalFilter; label: string }> = [
  { value: 'All', label: 'All Safety Tiers' },
  { value: 'Recommended', label: 'Recommended' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'Expert', label: 'Expert' },
  { value: 'Unsafe', label: 'Unsafe' },
  { value: 'Unlisted', label: 'Unlisted' },
];

const STATE_OPTIONS: Array<{ value: StateFilter; label: string }> = [
  { value: 'All', label: 'All States' },
  { value: 'Enabled', label: 'Enabled' },
  { value: 'Disabled', label: 'Disabled' },
  { value: 'Uninstalled', label: 'Uninstalled' },
];

export function DebloaterTab() {
  const packages = useDebloatStore((s) => s.packages);
  const listStatus = useDebloatStore((s) => s.listStatus);
  const isLoadingPackages = useDebloatStore((s) => s.isLoadingPackages);
  const isApplying = useDebloatStore((s) => s.isApplying);
  const searchQuery = useDebloatStore((s) => s.searchQuery);
  const listFilter = useDebloatStore((s) => s.listFilter);
  const removalFilter = useDebloatStore((s) => s.removalFilter);
  const stateFilter = useDebloatStore((s) => s.stateFilter);
  const selectedPackages = useDebloatStore((s) => s.selectedPackages);
  const currentPackageName = useDebloatStore((s) => s.currentPackageName);
  const expertMode = useDebloatStore((s) => s.expertMode);
  const disableMode = useDebloatStore((s) => s.disableMode);

  const setPackages = useDebloatStore((s) => s.setPackages);
  const setListStatus = useDebloatStore((s) => s.setListStatus);
  const setIsLoadingPackages = useDebloatStore((s) => s.setIsLoadingPackages);
  const setIsApplying = useDebloatStore((s) => s.setIsApplying);
  const setSearchQuery = useDebloatStore((s) => s.setSearchQuery);
  const setListFilter = useDebloatStore((s) => s.setListFilter);
  const setRemovalFilter = useDebloatStore((s) => s.setRemovalFilter);
  const setStateFilter = useDebloatStore((s) => s.setStateFilter);
  const togglePackage = useDebloatStore((s) => s.togglePackage);
  const selectAll = useDebloatStore((s) => s.selectAll);
  const unselectAll = useDebloatStore((s) => s.unselectAll);
  const setCurrentPackageName = useDebloatStore((s) => s.setCurrentPackageName);
  const setExpertMode = useDebloatStore((s) => s.setExpertMode);
  const setDisableMode = useDebloatStore((s) => s.setDisableMode);
  const applyResults = useDebloatStore((s) => s.applyResults);
  const setBackups = useDebloatStore((s) => s.setBackups);

  const [reviewOpen, setReviewOpen] = useState(false);

  // Load settings + packages once on mount
  const loadAll = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      // Load per-device settings
      const settings = await GetDebloatDeviceSettings();
      setDisableMode(settings.disableMode);
      setExpertMode(settings.expertMode);

      // Load packages + UAD list status
      const [pkgs, status] = await Promise.all([GetDebloatPackages(), LoadDebloatLists()]);
      setPackages(pkgs);
      setListStatus(status);

      // Load backups
      const backups = await ListDebloatBackups();
      setBackups(backups);
    } catch (error) {
      handleError('Debloater', error);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [setIsLoadingPackages, setDisableMode, setExpertMode, setPackages, setListStatus, setBackups]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Persist settings changes
  async function handleDisableModeChange(value: boolean) {
    setDisableMode(value);
    try {
      const settings = await GetDebloatDeviceSettings();
      await SaveDebloatDeviceSettings({ ...settings, disableMode: value });
    } catch {
      /* best-effort */
    }
  }

  async function handleExpertModeChange(value: boolean) {
    setExpertMode(value);
    try {
      const settings = await GetDebloatDeviceSettings();
      await SaveDebloatDeviceSettings({ ...settings, expertMode: value });
    } catch {
      /* best-effort */
    }
  }

  // Filtered list (client-side)
  const filteredPackages = useMemo(
    () => applyFilters(packages, { listFilter, removalFilter, stateFilter, searchQuery }),
    [packages, listFilter, removalFilter, stateFilter, searchQuery],
  );

  const currentPackage = useMemo(
    () => packages.find((p) => p.name === currentPackageName) ?? null,
    [packages, currentPackageName],
  );

  // Virtualizer
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    getScrollElement: () => listRef.current,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    estimateSize: () => 36,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  async function handleApply() {
    const pkgNames = Array.from(selectedPackages);
    const action: backend.DebloatAction = disableMode ? 'disable' : 'uninstall';
    setIsApplying(true);
    try {
      const results = await DebloatPackages(pkgNames, action, 0);
      applyResults(results);

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        toast.success(
          `${action === 'disable' ? 'Disabled' : 'Uninstalled'} ${succeeded} package${succeeded !== 1 ? 's' : ''}`,
        );
        useLogStore.getState().addLog(`Debloat: ${action} ${succeeded} packages`, 'success');
      } else {
        toast.warning(`Done: ${succeeded} succeeded, ${failed} failed`);
        useLogStore.getState().addLog(`Debloat: ${failed} failures`, 'error');
      }
    } catch (error) {
      handleError('Debloat', error);
    } finally {
      setIsApplying(false);
      setReviewOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search packages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* List filter */}
        <FilterDropdown
          label={listFilter === 'All' ? 'All Lists' : listFilter}
          options={LIST_OPTIONS}
          value={listFilter}
          onValueChange={(v) => setListFilter(v as DebloatListFilter)}
        />

        {/* Safety filter */}
        <FilterDropdown
          label={removalFilter === 'All' ? 'Safety' : removalFilter}
          options={REMOVAL_OPTIONS}
          value={removalFilter}
          onValueChange={(v) => setRemovalFilter(v as RemovalFilter)}
        />

        {/* State filter */}
        <FilterDropdown
          label={stateFilter === 'All' ? 'State' : stateFilter}
          options={STATE_OPTIONS}
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as StateFilter)}
        />

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={isLoadingPackages}
          onClick={() => void loadAll()}
        >
          <RefreshCcw className={cn('size-4', isLoadingPackages && 'animate-spin')} />
        </Button>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {isLoadingPackages
            ? 'Loading packages…'
            : `${filteredPackages.length} of ${packages.length} system packages`}
          {listStatus && (
            <span className="ml-2">
              · UAD {listStatus.source === 'remote' ? '✓' : '○'} {listStatus.lastUpdated}
            </span>
          )}
        </span>

        <div className="flex items-center gap-3">
          {/* Disable mode toggle */}
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              disableMode
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            onClick={() => void handleDisableModeChange(!disableMode)}
          >
            <span
              className={cn(
                'size-1.5 rounded-full transition-colors',
                disableMode ? 'bg-amber-500' : 'bg-muted-foreground',
              )}
            />
            Disable mode
          </button>

          {/* Expert mode toggle */}
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              expertMode
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            onClick={() => void handleExpertModeChange(!expertMode)}
          >
            <Shield className="size-3" />
            Expert {expertMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── Package list (virtualized) ───────────────────────────────────────── */}
      <div
        ref={listRef}
        className="h-[38vh] min-h-60 overflow-y-auto overflow-x-hidden rounded-lg border"
        role="listbox"
        aria-label="System packages"
        aria-multiselectable="true"
      >
        {isLoadingPackages ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading packages…
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {searchQuery ? 'No packages match your search.' : 'No packages found.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualRows.map((vRow) => {
              const pkg = filteredPackages[vRow.index];
              const isSelected = selectedPackages.has(pkg.name);
              const isCurrent = currentPackageName === pkg.name;
              const tierClasses = REMOVAL_TIER_CLASSES[pkg.removal];
              const stateClass = PKG_STATE_CLASSES[pkg.state];
              const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

              return (
                <div
                  key={pkg.name}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    setCurrentPackageName(pkg.name);
                    if (!isUnsafeBlocked) togglePackage(pkg.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setCurrentPackageName(pkg.name);
                      if (!isUnsafeBlocked) togglePackage(pkg.name);
                    }
                  }}
                  className={cn(
                    'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60 text-accent-foreground',
                    isCurrent && !isSelected && 'bg-muted/60',
                    isUnsafeBlocked && 'cursor-not-allowed opacity-50',
                  )}
                  style={{ height: `${vRow.size}px`, transform: `translateY(${vRow.start}px)` }}
                >
                  <CheckboxItem checked={isSelected} />
                  {/* State dot */}
                  <span className={cn('size-2 shrink-0 rounded-full', stateClass)} />
                  {/* Package name */}
                  <span className="flex-1 truncate font-mono text-xs">{pkg.name}</span>
                  {/* List badge */}
                  <span className="shrink-0 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                    {pkg.list}
                  </span>
                  {/* Safety badge */}
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium',
                      tierClasses.badge,
                    )}
                  >
                    {REMOVAL_TIER_LABELS[pkg.removal]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Description panel ───────────────────────────────────────────────── */}
      <div className="min-h-20 rounded-lg border bg-muted/20 px-4 py-3">
        <DescriptionPanel pkg={currentPackage} />
      </div>

      {/* ── Action bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAll}>
            <CheckSquare2 className="size-3.5" />
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={selectedPackages.size === 0}
            onClick={unselectAll}
          >
            <Square className="size-3.5" />
            Unselect All
          </Button>
        </div>

        <Button
          size="sm"
          disabled={selectedPackages.size === 0 || isApplying}
          variant={disableMode ? 'outline' : 'default'}
          onClick={() => setReviewOpen(true)}
        >
          {isApplying && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Review {disableMode ? 'Disable' : 'Uninstall'} ({selectedPackages.size})
        </Button>
      </div>

      <ReviewSelectionDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        selectedPackages={selectedPackages}
        packages={packages}
        disableMode={disableMode}
        onConfirm={handleApply}
        isApplying={isApplying}
      />
    </div>
  );
}

// ── FilterDropdown helper ─────────────────────────────────────────────────────

function FilterDropdown({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
          <Filter className="size-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Filter</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
