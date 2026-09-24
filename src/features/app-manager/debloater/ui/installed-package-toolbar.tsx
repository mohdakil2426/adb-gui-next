import { ArrowUpDown, CheckSquare, Search, Square, X } from "lucide-react";

import type { backend } from "@/desktop/models";
import type {
  InstalledPackageFilter,
  InstalledSortBy,
  SortOrder,
} from "@/features/app-manager/debloater/model/installation-store";
import { RefreshButton } from "@/shared/components/refresh-button";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

export type { InstalledPackageFilter as PackageFilter } from "@/features/app-manager/debloater/model/installation-store";

interface InstalledPackageToolbarProps {
  disabledCount: number;
  isAllFilteredSelected?: boolean;
  isLoadingPackages: boolean;
  onPackageFilterChange: (v: InstalledPackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (v: string) => void;
  onSortChange: (sortBy: InstalledSortBy, sortOrder: SortOrder) => void;
  onToggleSelectAllFiltered?: () => void;
  packageFilter: InstalledPackageFilter;
  packages: backend.InstalledPackage[];
  searchQuery: string;
  selectedSerial: string | null;
  sortBy: InstalledSortBy;
  sortOrder: SortOrder;
  systemCount: number;
  userCount: number;
}
const DEFAULT_SORT_OPTION = {
  id: "name-asc",
  label: "Name (A → Z)",
  sortBy: "name" as const,
  sortOrder: "asc" as const,
};

const SORT_OPTIONS: {
  id: string;
  label: string;
  sortBy: InstalledSortBy;
  sortOrder: SortOrder;
}[] = [
  DEFAULT_SORT_OPTION,
  { id: "name-desc", label: "Name (Z → A)", sortBy: "name", sortOrder: "desc" },
  {
    id: "package-asc",
    label: "Package ID (A → Z)",
    sortBy: "package",
    sortOrder: "asc",
  },
  {
    id: "package-desc",
    label: "Package ID (Z → A)",
    sortBy: "package",
    sortOrder: "desc",
  },
  {
    id: "size-desc",
    label: "APK Size (Largest first)",
    sortBy: "size",
    sortOrder: "desc",
  },
  {
    id: "size-asc",
    label: "APK Size (Smallest first)",
    sortBy: "size",
    sortOrder: "asc",
  },
  {
    id: "sdk-desc",
    label: "Target SDK (Newest first)",
    sortBy: "targetSdk",
    sortOrder: "desc",
  },
  {
    id: "sdk-asc",
    label: "Target SDK (Oldest first)",
    sortBy: "targetSdk",
    sortOrder: "asc",
  },
];
/** Precision Hardware Cockpit Toolbar for Installed Applications. */
export const InstalledPackageToolbar = ({
  disabledCount,
  isAllFilteredSelected = false,
  isLoadingPackages,
  onPackageFilterChange,
  onRefresh,
  onSearchQueryChange,
  onSortChange,
  onToggleSelectAllFiltered,
  packageFilter,
  packages,
  searchQuery,
  selectedSerial,
  sortBy,
  sortOrder,
  systemCount,
  userCount,
}: InstalledPackageToolbarProps) => {
  const currentSortOption =
    SORT_OPTIONS.find((opt) => opt.sortBy === sortBy && opt.sortOrder === sortOrder) ??
    DEFAULT_SORT_OPTION;

  const filterPills: {
    count: number;
    id: InstalledPackageFilter;
    label: string;
  }[] = [
    { count: packages.length, id: "all", label: "All" },
    { count: userCount, id: "user", label: "User" },
    { count: systemCount, id: "system", label: "System" },
    { count: disabledCount, id: "disabled", label: "Disabled" },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Field with Clear Button */}
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          />
          <Input
            aria-label="Search installed packages"
            className="text-body h-9 pr-8 pl-8"
            disabled={!selectedSerial}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search apps by name or package ID…"
            value={searchQuery}
          />
          {searchQuery ? (
            <Button
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 size-6 -translate-y-1/2 p-0"
              onClick={() => onSearchQueryChange("")}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            </Button>
          ) : null}
        </div>

        {/* Quick Filter Pills */}
        <div className="border-border/70 bg-surface-raised/40 flex items-center gap-1 rounded-md border p-0.5">
          {filterPills.map((pill) => {
            const isActive = packageFilter === pill.id;
            return (
              <Button
                className={cn(
                  "text-caption h-7 gap-1.5 px-2.5 font-medium",
                  isActive
                    ? "bg-surface text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-surface/50 hover:text-foreground"
                )}
                key={pill.id}
                onClick={() => onPackageFilterChange(pill.id)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <span>{pill.label}</span>
                <Badge
                  className={cn(
                    "numeric text-mono-sm px-1 py-0 font-mono",
                    isActive
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-muted text-muted-foreground border-transparent"
                  )}
                  variant="secondary"
                >
                  {pill.count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Sorting Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="text-body h-9 gap-1.5 font-normal"
              disabled={!selectedSerial}
              size="sm"
              type="button"
            >
              <ArrowUpDown
                aria-hidden="true"
                className="text-muted-foreground size-3.5"
                data-icon="inline-start"
              />
              <span className="hidden @md:inline-block">Sort:</span>
              <span className="text-foreground font-medium">{currentSortOption.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Sort packages by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(val) => {
                const opt = SORT_OPTIONS.find((o) => o.id === val);
                if (opt) {
                  onSortChange(opt.sortBy, opt.sortOrder);
                }
              }}
              value={currentSortOption.id}
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Select All Filtered Toggle */}
        {onToggleSelectAllFiltered ? (
          <Button
            className="text-caption h-9 gap-1.5 font-medium"
            disabled={!selectedSerial || packages.length === 0}
            onClick={onToggleSelectAllFiltered}
            size="sm"
            type="button"
            variant="outline"
          >
            {isAllFilteredSelected ? (
              <Square
                aria-hidden="true"
                className="text-primary size-3.5"
                data-icon="inline-start"
              />
            ) : (
              <CheckSquare
                aria-hidden="true"
                className="text-muted-foreground size-3.5"
                data-icon="inline-start"
              />
            )}
            <span>{isAllFilteredSelected ? "Deselect all" : "Select filtered"}</span>
          </Button>
        ) : null}

        {/* Refresh Packages Button */}
        <RefreshButton
          aria-label="Refresh installed packages"
          buttonSize="icon"
          buttonVariant="outline"
          disabled={!selectedSerial}
          isLoading={isLoadingPackages}
          mode="icon"
          onClick={onRefresh}
          tooltip="Refresh installed packages"
        />
      </div>
    </div>
  );
};
