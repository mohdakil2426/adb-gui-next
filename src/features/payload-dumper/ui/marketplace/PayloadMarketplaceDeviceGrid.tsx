import { FirmwareDeviceCard } from '@/features/payload-dumper/ui/marketplace/FirmwareDeviceCard';
import type { FirmwareDeviceModel } from '@/features/payload-dumper/ui/marketplace/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

interface PayloadMarketplaceDeviceGridProps {
  filteredDevices: FirmwareDeviceModel[];
  isLoading: boolean;
  onClearFilters: () => void;
  onSelectDevice: (device: FirmwareDeviceModel) => void;
}

export function PayloadMarketplaceDeviceGrid({
  filteredDevices,
  isLoading,
  onClearFilters,
  onSelectDevice,
}: PayloadMarketplaceDeviceGridProps) {
  if (isLoading) {
    return (
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
    );
  }

  if (filteredDevices.length === 0) {
    return (
      <Card className="rounded-xl border-border bg-surface p-12 text-center shadow-none">
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
    <div className="grid @md:grid-cols-2 @xl:grid-cols-3 grid-cols-1 gap-4">
      {filteredDevices.map((device) => (
        <FirmwareDeviceCard device={device} key={device.id} onSelect={onSelectDevice} />
      ))}
    </div>
  );
}
