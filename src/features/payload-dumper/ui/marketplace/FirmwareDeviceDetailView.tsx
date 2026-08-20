import { ArrowLeft, Cpu, ExternalLink, Globe, Layers, Search, Smartphone, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BrowserOpenURL } from '@/desktop/runtime';
import { FirmwareBuildCard } from '@/features/payload-dumper/ui/marketplace/FirmwareBuildCard';
import {
  BRAND_DISPLAY_INFO,
  type FirmwareDeviceModel,
  type FirmwareImageType,
} from '@/features/payload-dumper/ui/marketplace/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

export interface FirmwareDeviceDetailViewProps {
  device: FirmwareDeviceModel;
  onBack: () => void;
  onSelectRemoteUrl: (url: string) => void;
}

export function FirmwareDeviceDetailView({
  device,
  onBack,
  onSelectRemoteUrl,
}: FirmwareDeviceDetailViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FirmwareImageType | 'all'>(() => {
    if (device.builds.some((b) => b.imageType === 'ota')) {
      return 'ota';
    }
    if (device.builds.some((b) => b.imageType === 'factory')) {
      return 'factory';
    }
    return 'all';
  });
  const brandInfo = BRAND_DISPLAY_INFO[device.brand] ?? {
    displayName: device.brand,
    portalName: 'Official Firmware Portal',
    portalUrl: 'https://developers.google.com/android/ota',
    shortLabel: device.brand,
  };

  const otaBuildsCount = device.builds.filter((b) => b.imageType === 'ota').length;
  const factoryBuildsCount = device.builds.filter((b) => b.imageType === 'factory').length;

  const filteredBuilds = useMemo(
    () =>
      device.builds.filter((build) => {
        const matchesType = selectedType === 'all' || build.imageType === selectedType;
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
          return matchesType;
        }
        const matchesQuery =
          build.version.toLowerCase().includes(query) ||
          build.buildId.toLowerCase().includes(query) ||
          build.androidVersion.toLowerCase().includes(query) ||
          (build.releaseDate && build.releaseDate.toLowerCase().includes(query)) ||
          (build.carrier && build.carrier.toLowerCase().includes(query)) ||
          (build.securityPatch && build.securityPatch.toLowerCase().includes(query));
        return matchesType && matchesQuery;
      }),
    [device.builds, selectedType, searchQuery],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top Bar: Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} size="sm" type="button" variant="outline">
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back to Device Catalog
        </Button>
        <div className="flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
          <span>Firmware Hub</span>
          <span>/</span>
          <span>{brandInfo.displayName}</span>
          <span>/</span>
          <span className="font-medium text-foreground">{device.name}</span>
        </div>
      </div>

      {/* Device Hero Banner */}
      <Card className="rounded-xl border-border bg-surface p-4.5 shadow-none">
        <CardContent className="flex flex-col gap-4 p-0">
          <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-primary">
                <Smartphone className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground text-title">{device.name}</h2>
                  <Badge variant="outline">{device.codename}</Badge>
                  <Badge variant="outline">{brandInfo.displayName}</Badge>
                  {device.series ? <Badge variant="secondary">{device.series}</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                  {device.soc ? (
                    <span className="flex items-center gap-1">
                      <Cpu className="size-3.5" />
                      {device.soc}
                    </span>
                  ) : null}
                  {device.releaseYear ? (
                    <>
                      <span>·</span>
                      <span>Released {device.releaseYear}</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span className="text-foreground">
                    {otaBuildsCount} {device.brand === 'xiaomi' ? 'Recovery' : 'OTA'} &{' '}
                    {factoryBuildsCount} {device.brand === 'xiaomi' ? 'Fastboot' : 'Factory'} Images
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => BrowserOpenURL(brandInfo.portalUrl)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Globe className="mr-1.5 size-3.5" />
                {brandInfo.portalName}
                <ExternalLink className="ml-1 size-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search builds, version, patch date"
            className="h-8 pl-8 text-body"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search build ID, version, patch date…"
            value={searchQuery}
          />
        </div>

        {/* Firmware Type Switcher */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-1">
          <Button
            className="h-7 px-3 text-caption"
            onClick={() => setSelectedType('ota')}
            size="sm"
            type="button"
            variant={selectedType === 'ota' ? 'default' : 'ghost'}
          >
            <Zap className="mr-1.5 size-3 text-amber-400" />
            {device.brand === 'xiaomi'
              ? 'Recovery ROM (Remote Stream)'
              : 'Full OTA Images (Remote Stream)'}
          </Button>
          <Button
            className="h-7 px-3 text-caption"
            onClick={() => setSelectedType('factory')}
            size="sm"
            type="button"
            variant={selectedType === 'factory' ? 'default' : 'ghost'}
          >
            <Layers className="mr-1.5 size-3" />
            {device.brand === 'xiaomi' ? 'Fastboot ROM (TGZ)' : 'Factory Images (Fastboot)'}
          </Button>
          <Button
            className="h-7 px-2.5 text-caption"
            onClick={() => setSelectedType('all')}
            size="sm"
            type="button"
            variant={selectedType === 'all' ? 'default' : 'ghost'}
          >
            All
          </Button>
        </div>
      </div>

      {/* Builds List */}
      <div className="flex flex-col gap-3">
        {filteredBuilds.length === 0 ? (
          <Card className="rounded-xl border-border bg-surface p-8 text-center shadow-none">
            <p className="text-body text-muted-foreground">
              No firmware builds matched your filter or search query.
            </p>
          </Card>
        ) : (
          filteredBuilds.map((build) => (
            <FirmwareBuildCard
              build={build}
              device={device}
              key={build.id}
              onSelectRemoteUrl={onSelectRemoteUrl}
            />
          ))
        )}
      </div>
    </div>
  );
}
