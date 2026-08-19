import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  GetFirmwareCatalog,
  GetSupportedFirmwareBrands,
  RefreshFirmwareCatalog,
} from '@/desktop/backend';
import type {
  BrandFilter,
  FirmwareBrand,
  FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';

const DEFAULT_SUPPORTED_BRANDS: FirmwareBrand[] = [
  'google',
  'nothing',
  'xiaomi',
  'oneplus',
  'samsung',
];

export interface UseFirmwareCatalogResult {
  brandCounts: Record<string, number>;
  devices: FirmwareDeviceModel[];
  isFetching: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  supportedBrands: FirmwareBrand[];
}

export function useFirmwareCatalog(selectedBrand: BrandFilter = 'all'): UseFirmwareCatalogResult {
  const queryClient = useQueryClient();
  const brandParam: FirmwareBrand | undefined =
    selectedBrand === 'all' ? undefined : (selectedBrand as FirmwareBrand);

  const { data: supportedBrands = DEFAULT_SUPPORTED_BRANDS } = useQuery({
    queryKey: ['firmware', 'supportedBrands'],
    queryFn: GetSupportedFirmwareBrands,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Query all devices to calculate accurate brand counts across the entire catalog
  const {
    data: allDevices = [],
    isLoading: isAllLoading,
    isFetching: isAllFetching,
  } = useQuery({
    queryKey: ['firmware', 'catalog', 'all'],
    queryFn: () => GetFirmwareCatalog(undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Query specific brand devices if filtered, otherwise use allDevices
  const isAll = !brandParam;
  const {
    data: brandDevices,
    isLoading: isBrandLoading,
    isFetching: isBrandFetching,
  } = useQuery({
    queryKey: ['firmware', 'catalog', brandParam],
    queryFn: () => (brandParam ? GetFirmwareCatalog(brandParam) : Promise.resolve([])),
    enabled: !isAll,
    staleTime: 1000 * 60 * 5,
  });

  const devices = useMemo(() => {
    if (isAll) {
      return allDevices;
    }
    if (brandDevices && brandDevices.length > 0) {
      return brandDevices;
    }
    // Fallback to client-side filtering from allDevices
    return allDevices.filter((d) => d.brand === brandParam);
  }, [isAll, allDevices, brandDevices, brandParam]);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allDevices.length,
      google: 0,
      nothing: 0,
      xiaomi: 0,
      oneplus: 0,
      samsung: 0,
    };
    for (const brand of supportedBrands) {
      if (counts[brand] === undefined) {
        counts[brand] = 0;
      }
    }
    for (const device of allDevices) {
      counts[device.brand] = (counts[device.brand] ?? 0) + 1;
    }
    return counts;
  }, [allDevices, supportedBrands]);

  const isLoading = isAll
    ? isAllLoading && allDevices.length === 0
    : isBrandLoading && devices.length === 0;
  const isFetching = isAll ? isAllFetching : isBrandFetching || isAllFetching;

  const refresh = useCallback(async () => {
    await RefreshFirmwareCatalog(brandParam);
    await queryClient.invalidateQueries({ queryKey: ['firmware', 'catalog'] });
  }, [brandParam, queryClient]);

  return {
    brandCounts,
    devices,
    isFetching,
    isLoading,
    refresh,
    supportedBrands,
  };
}
