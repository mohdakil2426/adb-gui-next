import { RefreshCw, Sparkles, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FirmwareDeviceDetailView } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceDetailView';
import { PayloadMarketplaceDeviceGrid } from '@/features/payload-dumper/ui/marketplace/PayloadMarketplaceDeviceGrid';
import { PayloadMarketplaceFilterBar } from '@/features/payload-dumper/ui/marketplace/PayloadMarketplaceFilterBar';
import {
  BRAND_DISPLAY_INFO,
  type BrandFilter,
  type FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { useFirmwareCatalog } from '@/features/payload-dumper/ui/marketplace/useFirmwareCatalog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
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
              <RefreshCw
                className={cn('mr-1.5 size-3.5', isFetching && 'animate-spin')}
                data-icon="inline-start"
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar: Brand Chips, Search, Model Selector */}
      <PayloadMarketplaceFilterBar
        brandChips={brandChips}
        brandCounts={brandCounts}
        devices={devices}
        isModelOpen={isModelOpen}
        onBrandChange={handleBrandChange}
        onModelOpenChange={setIsModelOpen}
        onSearchChange={setSearchQuery}
        onSelectModelId={setSelectedModelId}
        searchQuery={searchQuery}
        selectedBrand={selectedBrand}
        selectedModel={selectedModel ?? undefined}
        selectedModelId={selectedModelId}
        sortedDevices={sortedDevices}
      />
      <PayloadMarketplaceDeviceGrid
        filteredDevices={filteredDevices}
        isLoading={isLoading}
        onClearFilters={() => {
          setSelectedBrand('all');
          setSelectedModelId('all');
          setSearchQuery('');
        }}
        onSelectDevice={setSelectedDevice}
      />
    </div>
  );
}
