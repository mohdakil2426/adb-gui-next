import { Filter, RefreshCcw, Search, Shield } from 'lucide-react';
import type {
  DebloatListFilter,
  RemovalFilter,
  StateFilter,
} from '@/features/app-manager/debloater/model/debloatStore';
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

function FilterDropdown({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  value: string;
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
  packagesCount,
  removalFilter,
  searchQuery,
  stateFilter,
}: {
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
  packagesCount: number;
  removalFilter: RemovalFilter;
  searchQuery: string;
  stateFilter: StateFilter;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search packages…"
            value={searchQuery}
          />
        </div>
        <FilterDropdown
          label={listFilter === 'All' ? 'All Lists' : listFilter}
          onValueChange={(v) => onListFilterChange(v as DebloatListFilter)}
          options={LIST_OPTIONS}
          value={listFilter}
        />
        <FilterDropdown
          label={removalFilter === 'All' ? 'Safety' : removalFilter}
          onValueChange={(v) => onRemovalFilterChange(v as RemovalFilter)}
          options={REMOVAL_OPTIONS}
          value={removalFilter}
        />
        <FilterDropdown
          label={stateFilter === 'All' ? 'State' : stateFilter}
          onValueChange={(v) => onStateFilterChange(v as StateFilter)}
          options={STATE_OPTIONS}
          value={stateFilter}
        />
        <Button
          aria-label="Refresh packages"
          className="size-9 shrink-0"
          disabled={isLoadingPackages}
          onClick={onRefresh}
          size="icon"
          variant="ghost"
        >
          <RefreshCcw className={cn('size-4', isLoadingPackages && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>
          {isLoadingPackages
            ? 'Loading packages…'
            : `${filteredCount} of ${packagesCount} system packages`}
          {listStatusLabel ? <span className="ml-2">· {listStatusLabel}</span> : null}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <Field className="w-auto gap-2" orientation="horizontal">
            <Switch
              checked={disableMode}
              id="debloat-disable-mode"
              onCheckedChange={onDisableModeChange}
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
              onCheckedChange={onExpertModeChange}
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
    </>
  );
}
