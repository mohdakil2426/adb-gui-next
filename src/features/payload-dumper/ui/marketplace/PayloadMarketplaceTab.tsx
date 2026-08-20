import {
  Check,
  ChevronsUpDown,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FirmwareDeviceCard } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceCard';
import { FirmwareDeviceDetailView } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceDetailView';
import {
  BRAND_DISPLAY_INFO,
  type BrandFilter,
  type FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { useFirmwareCatalog } from '@/features/payload-dumper/ui/marketplace/useFirmwareCatalog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
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

interface PayloadMarketplaceTabProps {
  onSelectRemoteUrl: (url: string) => void;
}

export function PayloadMarketplaceTab({ onSelectRemoteUrl }: PayloadMarketplaceTabProps) {
  const [selectedDevice, setSelectedDevice] = useState<FirmwareDeviceModel | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandFilter>('all');
  const [selectedModelId, setSelectedModelId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const { devices, isLoading, isFetching, refresh, brandCounts, supportedBrands } =
    useFirmwareCatalog(selectedBrand);

  const brandChips = useMemo(() => {
    const chips: Array<{ id: BrandFilter; label: string }> = [{ id: 'all', label: 'All' }];
    for (const brand of supportedBrands) {
      const info = BRAND_DISPLAY_INFO[brand];
      chips.push({
        id: brand,
        label: info?.displayName ?? brand.charAt(0).toUpperCase() + brand.slice(1),
      });
    }
    return chips;
  }, [supportedBrands]);
  const sortedDevices = useMemo(
    () =>
      [...devices].sort((a, b) => {
        const yearDiff = (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
        if (yearDiff !== 0) {
          return yearDiff;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }),
    [devices],
  );

  const selectedModel = useMemo(() => {
    if (selectedModelId === 'all') {
      return null;
    }
    return devices.find((d) => d.id === selectedModelId) ?? null;
  }, [devices, selectedModelId]);

  const filteredDevices = useMemo(
    () =>
      sortedDevices.filter((device) => {
        const matchesModel = selectedModelId === 'all' || device.id === selectedModelId;
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
          return matchesModel;
        }
        const matchesQuery =
          device.name.toLowerCase().includes(query) ||
          device.codename.toLowerCase().includes(query) ||
          (device.soc && device.soc.toLowerCase().includes(query)) ||
          (device.releaseYear && device.releaseYear.toString().includes(query)) ||
          (device.series && device.series.toLowerCase().includes(query));
        return matchesModel && matchesQuery;
      }),
    [sortedDevices, selectedModelId, searchQuery],
  );
  const handleBrandChange = (brand: BrandFilter) => {
    setSelectedBrand(brand);
    setSelectedModelId('all');
  };

  const isFiltered =
    selectedBrand !== 'all' || selectedModelId !== 'all' || Boolean(searchQuery.trim());
  const totalCountForBrand =
    selectedBrand === 'all'
      ? (brandCounts.all ?? devices.length)
      : (brandCounts[selectedBrand] ?? devices.length);

  if (selectedDevice) {
    return (
      <FirmwareDeviceDetailView
        device={selectedDevice}
        onBack={() => setSelectedDevice(null)}
        onSelectRemoteUrl={onSelectRemoteUrl}
      />
    );
  }

  return (
    <div className="@container flex flex-col gap-5">
      {/* Top Banner */}
      <Card className="rounded-xl border-border bg-surface p-4.5 shadow-none">
        <CardContent className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-4 p-0">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-primary">
              <Store className="size-5.5" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground text-title">
                  Firmware Hub & Device Marketplace
                </h2>
                <Badge variant="outline">
                  <Sparkles className="mr-1 size-3 text-primary" />
                  Universal OTA Hub
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                Browse official Google Pixel, Nothing, Xiaomi, OnePlus, and Samsung firmware builds
                with verified SHA-256 hashes and 1-click remote partition stream extraction.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
              {isFiltered
                ? `${filteredDevices.length} of ${totalCountForBrand} Devices`
                : `${totalCountForBrand} Devices Available`}
            </Badge>
            <Button
              disabled={isFetching}
              onClick={() => void refresh()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className={cn('mr-1.5 size-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

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
              onClick={() => handleBrandChange(chip.id)}
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

      {/* Search & Dropdown Filters Bar (Left: Search, Right: Filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Global Search Bar */}
        <div className="relative min-w-[260px] max-w-sm flex-1 sm:flex-initial">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8.5 pr-8 pl-8 text-body"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search device model, codename (e.g. husky), SoC…"
            value={searchQuery}
          />
          {searchQuery ? (
            <Button
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 size-5 -translate-y-1/2 rounded-full p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-3" />
            </Button>
          ) : null}
        </div>

        {/* Right Side: All Models Dropdown Filter */}
        <div className="flex items-center gap-2">
          <Popover onOpenChange={setIsModelOpen} open={isModelOpen}>
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
                  <Smartphone className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {selectedModel ? selectedModel.name : 'All Models'}
                  </span>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 shadow-lg">
              <Command>
                <CommandInput placeholder="Search all models or codenames…" />
                <CommandList className="max-h-72">
                  <CommandEmpty>No device models found.</CommandEmpty>
                  <CommandGroup heading="Device Models">
                    {/* All Models Option */}
                    <CommandItem
                      className="flex items-center justify-between text-body"
                      key="all-models"
                      onSelect={() => {
                        setSelectedModelId('all');
                        setIsModelOpen(false);
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

                    {/* Individual Models */}
                    {sortedDevices.map((device) => {
                      const isSelected = selectedModelId === device.id;
                      return (
                        <CommandItem
                          className="flex items-center justify-between text-body"
                          key={device.id}
                          onSelect={() => {
                            setSelectedModelId(device.id);
                            setIsModelOpen(false);
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

          {/* Active Filter Reset */}
          {selectedModelId === 'all' ? null : (
            <Button
              className="h-8.5 px-2.5 text-caption text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedModelId('all')}
              size="sm"
              type="button"
              variant="ghost"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Device Grid / Loading Skeletons / Empty State */}
      {isLoading ? (
        <div className="grid @md:grid-cols-2 @xl:grid-cols-3 grid-cols-1 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              className="animate-pulse rounded-xl border-border bg-surface p-4.5 shadow-none"
              key={`skeleton-${i}`}
            >
              <CardContent className="flex flex-col gap-4 p-0">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-surface-raised" />
                  <div className="h-4 w-20 rounded-sm bg-surface-raised" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-3/4 rounded-sm bg-surface-raised" />
                  <div className="h-3.5 w-1/2 rounded-sm bg-surface-raised" />
                </div>
                <div className="h-8 rounded-md bg-surface-raised" />
                <div className="flex items-center justify-between border-border/40 border-t pt-3">
                  <div className="h-3.5 w-24 rounded-sm bg-surface-raised" />
                  <div className="h-3.5 w-16 rounded-sm bg-surface-raised" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <Card className="rounded-xl border-border bg-surface p-12 text-center shadow-none">
          <p className="text-body text-muted-foreground">
            No firmware devices matched your filter or search query.
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              setSelectedBrand('all');
              setSelectedModelId('all');
              setSearchQuery('');
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid @md:grid-cols-2 @xl:grid-cols-3 grid-cols-1 gap-4">
          {filteredDevices.map((device) => (
            <FirmwareDeviceCard device={device} key={device.id} onSelect={setSelectedDevice} />
          ))}
        </div>
      )}
    </div>
  );
}
