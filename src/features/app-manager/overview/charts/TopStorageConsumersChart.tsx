import { HardDrive } from 'lucide-react';
import type { StorageConsumer } from '@/features/app-manager/model/packageTypes';
import { formatBytes } from '@/shared/utils/format';

interface TopStorageConsumersChartProps {
  consumers: StorageConsumer[];
  onSelectApp?: ((packageName: string) => void) | undefined;
}

export function TopStorageConsumersChart({
  consumers,
  onSelectApp,
}: TopStorageConsumersChartProps) {
  const maxBytes = Math.max(...consumers.map((c) => c.totalSize), 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-primary" />
          <h3 className="font-medium text-foreground text-label">Top Space Consumers</h3>
        </div>
        <span className="text-caption text-muted-foreground">App + Data + Cache</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {consumers.map((app, index) => {
          const ratio = (app.totalSize / maxBytes) * 100;
          return (
            <button
              className="group flex flex-col gap-1 rounded-md p-1.5 text-left transition-colors hover:bg-surface-raised"
              key={app.packageName}
              onClick={() => onSelectApp?.(app.packageName)}
              type="button"
            >
              <div className="flex items-center justify-between text-body">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="numeric font-semibold text-caption text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="truncate font-medium text-foreground group-hover:text-primary">
                    {app.label || app.packageName}
                  </span>
                </div>
                <span className="numeric font-semibold text-caption text-foreground">
                  {formatBytes(app.totalSize)}
                </span>
              </div>

              {/* Sparkline horizontal bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 group-hover:bg-primary/80"
                  style={{ width: `${Math.max(4, ratio)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
