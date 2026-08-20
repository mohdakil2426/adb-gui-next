import { Check, ChevronsUpDown, Search, Smartphone, X } from 'lucide-react';
import type {
  BrandFilter,
  FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { Button } from '@/shared/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';
import { Input } from '@/shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/shared/utils/cn';

interface PayloadMarketplaceFilterBarProps {
  brandChips: Array<{ id: BrandFilter; label: string }>;
  brandCounts: Record<string, number>;
  devices: FirmwareDeviceModel[];
  isModelOpen: boolean;
  onBrandChange: (brand: BrandFilter) => void;
  onModelOpenChange: (open: boolean) => void;
  onSearchChange: (query: string) => void;
  onSelectModelId: (id: string) => void;
  searchQuery: string;
  selectedBrand: BrandFilter;
  selectedModel: FirmwareDeviceModel | undefined;
  selectedModelId: string;
  sortedDevices: FirmwareDeviceModel[];
}

export function PayloadMarketplaceFilterBar({
  brandChips,
  brandCounts,
  devices,
  isModelOpen,
  onBrandChange,
  onModelOpenChange,
  onSearchChange,
  onSelectModelId,
  searchQuery,
  selectedBrand,
  selectedModel,
  selectedModelId,
  sortedDevices,
}: PayloadMarketplaceFilterBarProps) {
  return (
    <>
      {/* Brand Selector Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {brandChips.map((chip) => {
          const count = brandCounts[chip.id] ?? 0;
          const isSelected = selectedBrand === chip.id;
          return (
            <Button
              className={cn(
                'h-8 rounded-full px-3.5 font-medium text-caption transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-surface-raised/60 text-muted-foreground hover:bg-surface-raised hover:text-foreground',
              )}
              key={chip.id}
              onClick={() => onBrandChange(chip.id)}
              size="sm"
              type="button"
              variant={isSelected ? 'default' : 'outline'}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.2 font-mono text-[10px]',
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Search & Dropdown Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search Bar */}
        <div className="relative min-w-[260px] max-w-sm flex-1 sm:flex-initial">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search device model, codename, or SoC"
            className="h-8.5 pr-8 pl-8 text-body"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search device model, codename (e.g. husky), SoC…"
            value={searchQuery}
          />
          {searchQuery ? (
            <Button
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange('')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-3" data-icon="inline-start" />
            </Button>
          ) : null}
        </div>

        {/* Right: Models Dropdown Filter */}
        <div className="flex items-center gap-2">
          <Popover onOpenChange={onModelOpenChange} open={isModelOpen}>
            <PopoverTrigger asChild>
              <Button
                aria-expanded={isModelOpen}
                className="h-8.5 min-w-[200px] max-w-[280px] justify-between gap-2 border-border-control bg-surface-raised/40 px-3 font-normal text-body hover:bg-surface-raised"
                role="combobox"
                size="sm"
                type="button"
                variant="outline"
              >
                <div className="flex min-w-0 items-center gap-2 truncate">
                  <Smartphone
                    className="size-3.5 shrink-0 text-muted-foreground"
                    data-icon="inline-start"
                  />
                  <span className="truncate">
                    {selectedModel ? selectedModel.name : 'All Models'}
                  </span>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" data-icon="inline-start" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 shadow-lg">
              <Command>
                <CommandInput placeholder="Search all models or codenames…" />
                <CommandList className="max-h-72">
                  <CommandEmpty>No device models found.</CommandEmpty>
                  <CommandGroup heading="Device Models">
                    <CommandItem
                      className="flex items-center justify-between text-body"
                      key="all-models"
                      onSelect={() => {
                        onSelectModelId('all');
                        onModelOpenChange(false);
                      }}
                      value="All Models all"
                    >
                      <div className="flex min-w-0 items-center gap-2 truncate">
                        <Check
                          className={cn(
                            'size-3.5 shrink-0 text-primary',
                            selectedModelId === 'all' ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span
                          className={cn(
                            'truncate',
                            selectedModelId === 'all' && 'font-medium text-foreground',
                          )}
                        >
                          All Models
                        </span>
                      </div>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {devices.length}
                      </span>
                    </CommandItem>

                    {sortedDevices.map((device) => {
                      const isSelected = selectedModelId === device.id;
                      return (
                        <CommandItem
                          className="flex items-center justify-between text-body"
                          key={device.id}
                          onSelect={() => {
                            onSelectModelId(device.id);
                            onModelOpenChange(false);
                          }}
                          value={`${device.name} ${device.codename} ${device.series ?? ''} ${device.soc ?? ''}`}
                        >
                          <div className="flex min-w-0 items-center gap-2 truncate">
                            <Check
                              className={cn(
                                'size-3.5 shrink-0 text-primary',
                                isSelected ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="flex min-w-0 items-center gap-1.5 truncate">
                              <span className={cn('truncate', isSelected && 'font-medium')}>
                                {device.name}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                ({device.codename})
                              </span>
                            </div>
                          </div>
                          {device.releaseYear ? (
                            <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                              {device.releaseYear}
                            </span>
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedModelId === 'all' ? null : (
            <Button
              className="h-8.5 px-2.5 text-caption text-muted-foreground hover:text-foreground"
              onClick={() => onSelectModelId('all')}
              size="sm"
              type="button"
              variant="ghost"
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
