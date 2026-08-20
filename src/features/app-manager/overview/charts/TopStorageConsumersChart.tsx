import { HardDrive } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { formatBytes } from '@/shared/utils/format';

const MAX_DISPLAY_CONSUMERS = 5;

interface TopStorageConsumersChartProps {
  consumers: backend.StorageConsumerItem[];
  onSelectApp?: ((packageName: string) => void) | undefined;
}

export function TopStorageConsumersChart({
  consumers,
  onSelectApp,
}: TopStorageConsumersChartProps) {
  const displayConsumers = consumers.slice(0, MAX_DISPLAY_CONSUMERS);
  const maxBytes = Math.max(...displayConsumers.map((c) => c.totalSize), 1);
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-primary" />
          <h3 className="font-medium text-foreground text-label">Top Space Consumers</h3>
        </div>
        <div className="flex items-center gap-3 text-caption text-muted-foreground">
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            <span>App</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/60" />
            <span>Data</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/30" />
            <span>Cache</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {displayConsumers.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-md border border-border border-dashed text-caption text-muted-foreground">
            No storage telemetry available
          </div>
        ) : (
          displayConsumers.map((app, index) => {
            const rawPkg =
              app.packageName ??
              (typeof app === 'object' &&
              app !== null &&
              'name' in app &&
              typeof app.name === 'string'
                ? app.name
                : '');
            const pkgName = rawPkg ? rawPkg.replace(/^["']+|["']+$/g, '') : '';
            const rawLabel = app.label || pkgName;
            const label = rawLabel ? rawLabel.replace(/^["']+|["']+$/g, '') : pkgName;
            const ratio = (app.totalSize / maxBytes) * 100;
            const appPct = app.totalSize > 0 ? (app.appSize / app.totalSize) * 100 : 40;
            const dataPct = app.totalSize > 0 ? (app.dataSize / app.totalSize) * 100 : 50;
            const cachePct = app.totalSize > 0 ? (app.cacheSize / app.totalSize) * 100 : 10;

            return (
              <button
                className="group flex flex-col gap-1 rounded-md p-1.5 text-left transition-colors hover:bg-surface-raised"
                key={pkgName || index}
                onClick={() => onSelectApp?.(pkgName)}
                type="button"
              >
                <div className="flex items-center justify-between text-body">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="numeric font-semibold text-caption text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="truncate font-medium text-foreground group-hover:text-primary">
                      {label}
                    </span>
                  </div>
                  <span className="numeric font-semibold text-caption text-foreground">
                    {formatBytes(app.totalSize)}
                  </span>
                </div>

                {/* Segmented multi-tone bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="flex h-full overflow-hidden rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(4, ratio)}%` }}
                  >
                    <div
                      className="h-full bg-primary transition-colors group-hover:bg-primary/90"
                      style={{ width: `${appPct}%` }}
                      title={`App: ${formatBytes(app.appSize)}`}
                    />
                    <div
                      className="h-full bg-primary/60 transition-colors group-hover:bg-primary/70"
                      style={{ width: `${dataPct}%` }}
                      title={`Data: ${formatBytes(app.dataSize)}`}
                    />
                    <div
                      className="h-full bg-primary/30 transition-colors group-hover:bg-primary/40"
                      style={{ width: `${cachePct}%` }}
                      title={`Cache: ${formatBytes(app.cacheSize)}`}
                    />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
