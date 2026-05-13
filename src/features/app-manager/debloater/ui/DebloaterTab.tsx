/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */

import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckSquare2, Filter, Loader2, RefreshCcw, Search, Shield, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckboxItem } from '@/components/CheckboxItem';
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
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { DebloatListFilter, RemovalFilter, StateFilter } from '@/lib/debloatStore';
import { applyFilters, useDebloatStore } from '@/lib/debloatStore';
import {
  DebloatPackages,
  GetDebloatData,
  GetDebloatDeviceSettings,
  SaveDebloatDeviceSettings,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';
import { cn } from '@/lib/utils';
import { DescriptionPanel } from './DescriptionPanel';
import { PKG_STATE_CLASSES, REMOVAL_TIER_CLASSES, REMOVAL_TIER_LABELS } from './debloaterUtils';
import { ReviewSelectionDialog } from './ReviewSelectionDialog';

const LIST_OPTIONS: { value: DebloatListFilter; label: string }[] = [
  { value: 'All', label: 'All Lists' },
  { value: 'Aosp', label: 'AOSP' },
  { value: 'Google', label: 'Google' },
  { value: 'Oem', label: 'OEM' },
  { value: 'Carrier', label: 'Carrier' },
  { value: 'Misc', label: 'Misc' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Unlisted', label: 'Unlisted' },
];

const REMOVAL_OPTIONS: { value: RemovalFilter; label: string }[] = [
  { value: 'All', label: 'All Safety Tiers' },
  { value: 'Recommended', label: 'Recommended' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'Expert', label: 'Expert' },
  { value: 'Unsafe', label: 'Unsafe' },
  { value: 'Unlisted', label: 'Unlisted' },
];

const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
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
      const data = await GetDebloatData();
      setPackages(data.packages);
      setListStatus(data.list_status);
      setDisableMode(data.settings.disableMode);
      setExpertMode(data.settings.expertMode);
      setBackups(data.backups);
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
    () =>
      applyFilters(packages, {
        listFilter,
        removalFilter,
        stateFilter,
        searchQuery,
      }),
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
          `${action === 'disable' ? 'Disabled' : 'Uninstalled'} ${succeeded} package${succeeded === 1 ? '' : 's'}`,
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
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search packages…"
            value={searchQuery}
          />
        </div>

        {/* List filter */}
        <FilterDropdown
          label={listFilter === 'All' ? 'All Lists' : listFilter}
          onValueChange={(v) => {
            setListFilter(v as DebloatListFilter);
          }}
          options={LIST_OPTIONS}
          value={listFilter}
        />

        {/* Safety filter */}
        <FilterDropdown
          label={removalFilter === 'All' ? 'Safety' : removalFilter}
          onValueChange={(v) => {
            setRemovalFilter(v as RemovalFilter);
          }}
          options={REMOVAL_OPTIONS}
          value={removalFilter}
        />

        {/* State filter */}
        <FilterDropdown
          label={stateFilter === 'All' ? 'State' : stateFilter}
          onValueChange={(v) => {
            setStateFilter(v as StateFilter);
          }}
          options={STATE_OPTIONS}
          value={stateFilter}
        />

        {/* Refresh */}
        <Button
          aria-label="Refresh packages"
          className="size-9 shrink-0"
          disabled={isLoadingPackages}
          onClick={() => void loadAll()}
          size="icon"
          variant="ghost"
        >
          <RefreshCcw className={cn('size-4', isLoadingPackages && 'animate-spin')} />
        </Button>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>
          {isLoadingPackages
            ? 'Loading packages…'
            : `${filteredPackages.length} of ${packages.length} system packages`}
          {listStatus ? (
            <span className="ml-2">
              · UAD {listStatus.source === 'remote' ? '✓' : '○'} {listStatus.lastUpdated}
            </span>
          ) : null}
        </span>

        <div className="flex flex-wrap items-center gap-4">
          <Field className="w-auto gap-2" orientation="horizontal">
            <Switch
              checked={disableMode}
              id="debloat-disable-mode"
              onCheckedChange={(value) => void handleDisableModeChange(value)}
            />
            <FieldContent className="gap-0">
              <FieldLabel className="text-xs" htmlFor="debloat-disable-mode">
                Disable mode
              </FieldLabel>
              <FieldDescription className="sr-only">Disable instead of uninstall.</FieldDescription>
            </FieldContent>
          </Field>

          <Field className="w-auto gap-2" orientation="horizontal">
            <Switch
              checked={expertMode}
              id="debloat-expert-mode"
              onCheckedChange={(value) => void handleExpertModeChange(value)}
            />
            <FieldContent className="gap-0">
              <FieldLabel className="text-xs" htmlFor="debloat-expert-mode">
                <Shield className="size-3" />
                Expert mode
              </FieldLabel>
              <FieldDescription className="sr-only">
                Allow unsafe package selection.
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>
      </div>

      {/* ── Package list (virtualized) ───────────────────────────────────────── */}
      <div
        aria-label="System packages"
        aria-multiselectable="true"
        className="h-[38vh] min-h-60 overflow-y-auto overflow-x-hidden rounded-lg border"
        ref={listRef}
        role="listbox"
      >
        {isLoadingPackages ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading packages…
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
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
              if (!pkg) {
                return null;
              }
              const isSelected = selectedPackages.has(pkg.name);
              const isCurrent = currentPackageName === pkg.name;
              const tierClasses = REMOVAL_TIER_CLASSES[pkg.removal];
              const stateClass = PKG_STATE_CLASSES[pkg.state];
              const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

              return (
                <div
                  aria-selected={isSelected}
                  className={cn(
                    'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60 text-accent-foreground',
                    isCurrent && !isSelected && 'bg-muted/60',
                    isUnsafeBlocked && 'cursor-not-allowed opacity-50',
                  )}
                  key={pkg.name}
                  onClick={() => {
                    setCurrentPackageName(pkg.name);
                    if (!isUnsafeBlocked) {
                      togglePackage(pkg.name);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setCurrentPackageName(pkg.name);
                      if (!isUnsafeBlocked) {
                        togglePackage(pkg.name);
                      }
                    }
                  }}
                  role="option"
                  style={{
                    height: `${vRow.size}px`,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                  tabIndex={0}
                >
                  <CheckboxItem checked={isSelected} />
                  {/* State dot */}
                  <span className={cn('size-2 shrink-0 rounded-full', stateClass)} />
                  {/* Package name */}
                  <span className="flex-1 truncate font-mono text-xs">{pkg.name}</span>
                  {/* List badge */}
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-[9px] text-muted-foreground">
                    {pkg.list}
                  </span>
                  {/* Safety badge */}
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 font-medium text-[9px]',
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
        <Button
          className="h-8 text-xs"
          disabled={filteredPackages.length === 0}
          onClick={() => {
            if (selectedPackages.size > 0) {
              unselectAll();
            } else {
              selectAll();
            }
          }}
          size="sm"
          variant="ghost"
        >
          {selectedPackages.size > 0 ? (
            <>
              <CheckSquare2 data-icon="inline-start" />
              Unselect All
            </>
          ) : (
            <>
              <Square data-icon="inline-start" />
              Select All
            </>
          )}
        </Button>

        <Button
          disabled={selectedPackages.size === 0 || isApplying}
          onClick={() => {
            setReviewOpen(true);
          }}
          size="sm"
          variant={disableMode ? 'outline' : 'default'}
        >
          {isApplying ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Review {disableMode ? 'Disable' : 'Uninstall'} ({selectedPackages.size})
        </Button>
      </div>

      <ReviewSelectionDialog
        disableMode={disableMode}
        isApplying={isApplying}
        onConfirm={handleApply}
        onOpenChange={setReviewOpen}
        open={reviewOpen}
        packages={packages}
        selectedPackages={selectedPackages}
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
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-9 gap-1.5 text-xs" size="sm" variant="outline">
          <Filter data-icon="inline-start" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Filter</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
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
