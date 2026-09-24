import { m, useReducedMotion } from "framer-motion";
import { HardDrive } from "lucide-react";

import type { backend } from "@/desktop/models";
import { formatBytes } from "@/shared/utils/format";

const MAX_DISPLAY_CONSUMERS = 5;

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

interface TopStorageConsumersChartProps {
  consumers: backend.StorageConsumerItem[];
  onSelectApp?: ((packageName: string) => void) | undefined;
}

export const TopStorageConsumersChart = ({
  consumers,
  onSelectApp,
}: TopStorageConsumersChartProps) => {
  const shouldReduceMotion = useReducedMotion();
  const displayConsumers = consumers.slice(0, MAX_DISPLAY_CONSUMERS);
  const maxBytes = Math.max(...displayConsumers.map((c) => c.totalSize), 1);

  return (
    <div className="border-border bg-surface flex h-full flex-col justify-between gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive aria-hidden="true" className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Top Space Consumers</h3>
        </div>
        <div className="text-caption text-muted-foreground flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
            <span>App</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="bg-primary/60 size-1.5 rounded-full" />
            <span>Data</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="bg-primary/30 size-1.5 rounded-full" />
            <span>Cache</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {displayConsumers.length === 0 ? (
          <div className="border-border text-caption text-muted-foreground flex h-32 items-center justify-center rounded-md border border-dashed">
            No storage telemetry available
          </div>
        ) : (
          displayConsumers.map((app, index) => {
            const rawPkg =
              app.packageName ??
              (typeof app === "object" &&
              app !== null &&
              "name" in app &&
              typeof app.name === "string"
                ? app.name
                : "");
            const pkgName = rawPkg ? rawPkg.replaceAll(/^["']+|["']+$/gu, "") : "";
            const rawLabel = app.label || pkgName;
            const label = rawLabel ? rawLabel.replaceAll(/^["']+|["']+$/gu, "") : pkgName;
            const ratio = (app.totalSize / maxBytes) * 100;
            const appPct = app.totalSize > 0 ? (app.appSize / app.totalSize) * 100 : 40;
            const dataPct = app.totalSize > 0 ? (app.dataSize / app.totalSize) * 100 : 50;
            const cachePct = app.totalSize > 0 ? (app.cacheSize / app.totalSize) * 100 : 10;

            return (
              <m.button
                animate={{ opacity: 1, x: 0 }}
                className="group hover:bg-surface-raised flex flex-col gap-1 rounded-md p-1.5 text-left transition-colors"
                initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                key={pkgName || index}
                onClick={() => onSelectApp?.(pkgName)}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        delay: 0.1 + index * 0.06,
                        duration: 0.3,
                        ease: EASE_STANDARD,
                      }
                }
                type="button"
              >
                <div className="text-body flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="numeric text-caption text-muted-foreground font-semibold">
                      #{index + 1}
                    </span>
                    <span className="text-foreground group-hover:text-primary truncate font-medium">
                      {label}
                    </span>
                  </div>
                  <span className="numeric text-caption text-foreground font-semibold">
                    {formatBytes(app.totalSize)}
                  </span>
                </div>

                {/* Segmented multi-tone bar; the track width is static, only the segments draw in */}
                <div className="bg-surface-raised h-2 w-full overflow-hidden rounded-full">
                  <m.div
                    animate={{ opacity: 1 }}
                    className="flex h-full overflow-hidden rounded-full"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    style={{ width: `${Math.max(4, ratio)}%` }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { delay: 0.15 + index * 0.06, duration: 0.4 }
                    }
                  >
                    <div
                      className="bg-primary group-hover:bg-primary/90 h-full transition-colors"
                      style={{ width: `${appPct}%` }}
                      title={`App: ${formatBytes(app.appSize)}`}
                    />
                    <div
                      className="bg-primary/60 group-hover:bg-primary/70 h-full transition-colors"
                      style={{ width: `${dataPct}%` }}
                      title={`Data: ${formatBytes(app.dataSize)}`}
                    />
                    <div
                      className="bg-primary/30 group-hover:bg-primary/40 h-full transition-colors"
                      style={{ width: `${cachePct}%` }}
                      title={`Cache: ${formatBytes(app.cacheSize)}`}
                    />
                  </m.div>
                </div>
              </m.button>
            );
          })
        )}
      </div>
    </div>
  );
};
