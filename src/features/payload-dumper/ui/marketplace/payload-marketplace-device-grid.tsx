import { FirmwareDeviceCard } from "@/features/payload-dumper/ui/marketplace/firmware-device-card";
import type { FirmwareDeviceModel } from "@/features/payload-dumper/ui/marketplace/types";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

interface PayloadMarketplaceDeviceGridProps {
  filteredDevices: FirmwareDeviceModel[];
  isLoading: boolean;
  onClearFilters: () => void;
  onSelectDevice: (device: FirmwareDeviceModel) => void;
}

export const PayloadMarketplaceDeviceGrid = ({
  filteredDevices,
  isLoading,
  onClearFilters,
  onSelectDevice,
}: PayloadMarketplaceDeviceGridProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            className="border-border bg-surface animate-pulse rounded-xl p-4.5 shadow-none"
            key={`skeleton-${i}`}
          >
            <CardContent className="flex flex-col gap-4 p-0">
              <div className="flex items-center justify-between">
                <div className="bg-surface-raised size-9 rounded-lg" />
                <div className="bg-surface-raised h-4 w-20 rounded-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="bg-surface-raised h-5 w-3/4 rounded-sm" />
                <div className="bg-surface-raised h-3.5 w-1/2 rounded-sm" />
              </div>
              <div className="bg-surface-raised h-8 rounded-md" />
              <div className="border-border/40 flex items-center justify-between border-t pt-3">
                <div className="bg-surface-raised h-3.5 w-24 rounded-sm" />
                <div className="bg-surface-raised h-3.5 w-16 rounded-sm" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredDevices.length === 0) {
    return (
      <Card className="border-border bg-surface rounded-xl p-12 text-center shadow-none">
        <p className="text-body text-muted-foreground">
          No firmware devices matched your filter or search query.
        </p>
        <Button className="mt-3" onClick={onClearFilters} size="sm" type="button" variant="outline">
          Clear Filters
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @xl:grid-cols-3">
      {filteredDevices.map((device) => (
        <FirmwareDeviceCard device={device} key={device.id} onSelect={onSelectDevice} />
      ))}
    </div>
  );
};
