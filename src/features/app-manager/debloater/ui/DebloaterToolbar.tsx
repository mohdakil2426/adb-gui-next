import { Building2, Layers, Search, Shield, ShieldAlert, X } from 'lucide-react';
import { useMemo } from 'react';
import type { backend } from '@/desktop/models';
import type {
  DebloatListFilter,
  RemovalFilter,
  StateFilter,
} from '@/features/app-manager/debloater/model/debloatStore';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/utils/cn';
import { DebloaterSafetyChips } from './DebloaterSafetyChips';
import { OEM_LIST_OPTIONS, STATE_OPTIONS } from './debloaterConstants';
import { countAllByTier } from './debloaterUtils';

interface DebloaterToolbarProps {
  disableMode: boolean;
  expertMode: boolean;
  filteredCount: number;
  isLoadingPackages: boolean;
  listFilter: DebloatListFilter;
  listStatusLabel: string | null;
  onDisableModeChange: (value: boolean) => void;
  onExpertModeChange: (value: boolean) => void;
  onListFilterChange: (v: DebloatListFilter) => void;
  onRefresh: () => void;
  onRemovalFilterChange: (v: RemovalFilter) => void;
  onSearchQueryChange: (v: string) => void;
  onStateFilterChange: (v: StateFilter) => void;
  packages?: backend.DebloatPackageRow[];
  packagesCount: number;
  removalFilter: RemovalFilter;
  searchQuery: string;
  selectedCount?: number;
  selectedSerial: string | null;
  stateFilter: StateFilter;
}

export function DebloaterToolbar({
  disableMode,
  expertMode,
  filteredCount,
  isLoadingPackages,
  listFilter,
  listStatusLabel,
  onDisableModeChange,
  onExpertModeChange,
  onListFilterChange,
  onRefresh,
  onRemovalFilterChange,
  onSearchQueryChange,
  onStateFilterChange,
  packages = [],
  packagesCount,
  removalFilter,
  searchQuery,
  selectedCount = 0,
  selectedSerial,
  stateFilter,
}: DebloaterToolbarProps) {
  const tierCounts = useMemo(() => countAllByTier(packages), [packages]);

  const listLabel = useMemo(() => {
    const found = OEM_LIST_OPTIONS.find((opt) => opt.value === listFilter);
    return found ? found.label.split(' (')[0] : listFilter;
  }, [listFilter]);

  const stateLabel = useMemo(() => {
    const found = STATE_OPTIONS.find((opt) => opt.value === stateFilter);
    return found ? found.label.replace(' Only', '') : stateFilter;
  }, [stateFilter]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* ── Search & Filter Controls Band ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search system package list"
            className="h-9 pr-8 pl-8 text-body"
            disabled={!selectedSerial}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search packages by name or description…"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xs p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onSearchQueryChange('')}
              type="button"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 gap-1.5"
              disabled={!selectedSerial}
              size="sm"
              type="button"
              variant="outline"
            >
              <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate">{listLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Vendor / OEM List</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(v) => onListFilterChange(v as DebloatListFilter)}
              value={listFilter}
            >
              {OEM_LIST_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 gap-1.5"
              disabled={!selectedSerial}
              size="sm"
              type="button"
              variant="outline"
            >
              <Layers aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate">{stateLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Package State</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(v) => onStateFilterChange(v as StateFilter)}
              value={stateFilter}
            >
              {STATE_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <RefreshButton
          aria-label="Refresh system packages"
          buttonSize="icon"
          buttonVariant="outline"
          disabled={!selectedSerial}
          isLoading={isLoadingPackages}
          mode="icon"
          onClick={onRefresh}
          tooltip="Refresh system packages"
        />
      </div>

      {/* ── Safety Tier Filter Chips Bar ── */}
      <DebloaterSafetyChips
        onRemovalFilterChange={onRemovalFilterChange}
        packagesCount={packagesCount}
        removalFilter={removalFilter}
        tierCounts={tierCounts}
      />

      {/* ── Telemetry & Mode Toggles Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-border/40 border-t pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="numeric text-caption text-muted-foreground">
            {isLoadingPackages
              ? 'Loading packages…'
              : `${filteredCount} of ${packagesCount} system packages`}
          </span>
          {selectedCount > 0 ? (
            <Badge className="font-mono text-caption" variant="default">
              {selectedCount} selected
            </Badge>
          ) : null}
          {listStatusLabel ? (
            <span className="numeric text-caption text-muted-foreground/80">
              · {listStatusLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Field className="w-auto gap-2" orientation="horizontal">
            <Switch
              checked={disableMode}
              disabled={!selectedSerial}
              id="debloat-disable-mode"
              onCheckedChange={onDisableModeChange}
            />
            <FieldContent className="gap-0">
              <FieldLabel className="cursor-pointer text-label" htmlFor="debloat-disable-mode">
                Disable mode
              </FieldLabel>
              <FieldDescription className="sr-only">
                Disable packages rather than removing them, so they can be re-enabled later.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field className="w-auto gap-2" orientation="horizontal">
            <Switch
              checked={expertMode}
              disabled={!selectedSerial}
              id="debloat-expert-mode"
              onCheckedChange={onExpertModeChange}
            />
            <FieldContent className="gap-0">
              <FieldLabel
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 text-label',
                  expertMode && 'font-semibold text-warning',
                )}
                htmlFor="debloat-expert-mode"
              >
                {expertMode ? (
                  <ShieldAlert aria-hidden="true" className="size-3.5 text-warning" />
                ) : (
                  <Shield aria-hidden="true" className="size-3.5 text-muted-foreground" />
                )}
                Expert mode
              </FieldLabel>
              <FieldDescription className="sr-only">
                Allow Unsafe packages to be selected and modified.
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>
      </div>
    </div>
  );
}
