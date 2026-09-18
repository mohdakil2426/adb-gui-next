import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  GetFirmwareCatalog,
  GetSupportedFirmwareBrands,
  RefreshFirmwareCatalog,
} from "@/desktop/backend";
import { formatCleanDeviceName } from "@/features/payload-dumper/ui/marketplace/types";
import type {
  BrandFilter,
  FirmwareBrand,
  FirmwareDeviceModel,
} from "@/features/payload-dumper/ui/marketplace/types";

// Empty state handled across UI when data?.length === 0

const DEFAULT_SUPPORTED_BRANDS: FirmwareBrand[] = [
  "google",
  "nothing",
  "xiaomi",
  "oneplus",
  "samsung",
];

export interface UseFirmwareCatalogResult {
  brandCounts: Record<string, number>;
  devices: FirmwareDeviceModel[];
  isFetching: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  supportedBrands: FirmwareBrand[];
}

export const useFirmwareCatalog = (
  selectedBrand: BrandFilter = "all"
): UseFirmwareCatalogResult => {
  const queryClient = useQueryClient();
  const brandParam: FirmwareBrand | undefined =
    selectedBrand === "all" ? undefined : (selectedBrand as FirmwareBrand);

  const { data: supportedBrands = DEFAULT_SUPPORTED_BRANDS } = useQuery({
    queryFn: GetSupportedFirmwareBrands,
    queryKey: ["firmware", "supportedBrands"],
    // 1 hour
    staleTime: 1000 * 60 * 60,
  });

  // Query all devices to calculate accurate brand counts across the entire catalog
  const {
    data: allDevices = [],
    isLoading: isAllLoading,
    isFetching: isAllFetching,
  } = useQuery({
    queryFn: () => GetFirmwareCatalog(),
    queryKey: ["firmware", "catalog", "all"],
    // 5 minutes
    staleTime: 1000 * 60 * 5,
  });

  // Query specific brand devices if filtered, otherwise use allDevices
  const isAll = !brandParam;
  const {
    data: brandDevices,
    isLoading: isBrandLoading,
    isFetching: isBrandFetching,
  } = useQuery({
    enabled: !isAll,
    queryFn: () => (brandParam ? GetFirmwareCatalog(brandParam) : Promise.resolve([])),
    queryKey: ["firmware", "catalog", brandParam],
    staleTime: 1000 * 60 * 5,
  });

  const devices = useMemo(() => {
    let raw = allDevices;
    if (!isAll) {
      raw =
        brandDevices && brandDevices.length > 0
          ? brandDevices
          : allDevices.filter((d) => d.brand === brandParam);
    }
    return raw.map((device) => {
      const cleanName = formatCleanDeviceName(device.name);
      return cleanName === device.name ? device : { ...device, name: cleanName };
    });
  }, [isAll, allDevices, brandDevices, brandParam]);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allDevices.length,
    };
    for (const brand of supportedBrands) {
      counts[brand] = 0;
    }
    if (allDevices.length > 0) {
      for (const device of allDevices) {
        counts[device.brand] = (counts[device.brand] ?? 0) + 1;
      }
    } else if (brandParam && brandDevices && brandDevices.length > 0) {
      counts[brandParam] = brandDevices.length;
      counts.all = brandDevices.length;
    }
    return counts;
  }, [allDevices, supportedBrands, brandParam, brandDevices]);

  const isLoading = isAll
    ? isAllLoading && allDevices.length === 0
    : isBrandLoading && devices.length === 0;
  const isFetching = isAll ? isAllFetching : isBrandFetching || isAllFetching;

  const refresh = useCallback(async () => {
    await RefreshFirmwareCatalog(brandParam);
    await queryClient.invalidateQueries({ queryKey: ["firmware", "catalog"] });
  }, [brandParam, queryClient]);

  return {
    brandCounts,
    devices,
    isFetching,
    isLoading,
    refresh,
    supportedBrands,
  };
};
