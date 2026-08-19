import { RefreshCw, Search, Sparkles, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FirmwareDeviceCard } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceCard';
import { FirmwareDeviceDetailView } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceDetailView';
import type {
  BrandFilter,
  FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { useFirmwareCatalog } from '@/features/payload-dumper/ui/marketplace/useFirmwareCatalog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/cn';

interface PayloadMarketplaceTabProps {
  onSelectRemoteUrl: (url: string) => void;
}

const BRAND_CHIPS: Array<{ id: BrandFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'google', label: 'Google Pixel' },
  { id: 'nothing', label: 'Nothing' },
  { id: 'xiaomi', label: 'Xiaomi' },
  { id: 'oneplus', label: 'OnePlus' },
  { id: 'samsung', label: 'Samsung' },
];

export function PayloadMarketplaceTab({ onSelectRemoteUrl }: PayloadMarketplaceTabProps) {
  const [selectedDevice, setSelectedDevice] = useState<FirmwareDeviceModel | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandFilter>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { devices, isLoading, isFetching, refresh, brandCounts } =
    useFirmwareCatalog(selectedBrand);

  const seriesOptions = useMemo(() => {
    const seriesSet = new Set<string>();
    for (const device of devices) {
      if (device.series) {
        seriesSet.add(device.series);
      }
    }
    return ['All', ...Array.from(seriesSet).sort()];
  }, [devices]);

  const filteredDevices = useMemo(
    () =>
      devices.filter((device) => {
        const matchesSeries = selectedSeries === 'All' || device.series === selectedSeries;
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
          return matchesSeries;
        }
        const matchesQuery =
          device.name.toLowerCase().includes(query) ||
          device.codename.toLowerCase().includes(query) ||
          (device.soc && device.soc.toLowerCase().includes(query)) ||
          (device.releaseYear && device.releaseYear.toString().includes(query)) ||
          (device.series && device.series.toLowerCase().includes(query));
        return matchesSeries && matchesQuery;
      }),
    [devices, selectedSeries, searchQuery],
  );

  const handleBrandChange = (brand: BrandFilter) => {
    setSelectedBrand(brand);
    setSelectedSeries('All');
  };

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
              {brandCounts.all ?? devices.length} Devices Available
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
        {BRAND_CHIPS.map((chip) => {
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

      {/* Search & Series Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-body"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search device model, codename (e.g. husky), SoC…"
            value={searchQuery}
          />
        </div>

        {/* Series Filter Chips */}
        {seriesOptions.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {seriesOptions.map((series) => (
              <Button
                className="h-7 px-2.5 text-caption"
                key={series}
                onClick={() => setSelectedSeries(series)}
                size="sm"
                type="button"
                variant={selectedSeries === series ? 'secondary' : 'ghost'}
              >
                {series}
              </Button>
            ))}
          </div>
        ) : null}
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
              setSelectedSeries('All');
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
