import { m, useReducedMotion } from "framer-motion";
import { HardDrive } from "lucide-react";
import { useMemo } from "react";

import type { backend } from "@/desktop/models";
import { formatBytes } from "@/shared/utils/format";

const MAX_DISPLAY_CONSUMERS = 5;

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

interface TopStorageConsumersChartProps {
  consumers: backend.StorageConsumerItem[];
  fallbackPackages?: backend.InstalledPackage[] | undefined;
  onSelectApp?: ((packageName: string) => void) | undefined;
}

export const TopStorageConsumersChart = ({
  consumers,
  fallbackPackages,
  onSelectApp,
}: TopStorageConsumersChartProps) => {
  const shouldReduceMotion = useReducedMotion();

  const fallbackMap = useMemo(() => {
    const map = new Map<string, backend.InstalledPackage>();
    if (fallbackPackages) {
      for (const pkg of fallbackPackages) {
        map.set(pkg.name, pkg);
      }
    }
    return map;
  }, [fallbackPackages]);

  const displayConsumers = useMemo(() => {
    const list: backend.StorageConsumerItem[] = consumers.map((c) => {
      const rawPkg =
        c.packageName ??
        (typeof c === "object" && c !== null && "name" in c && typeof c.name === "string"
          ? c.name
          : "");
      const pkgName = rawPkg ? rawPkg.replaceAll(/^["']+|["']+$/gu, "") : "";
      const matched = fallbackMap.get(pkgName);
      return {
        ...c,
        label: matched?.label || c.label || pkgName,
        packageName: pkgName,
      };
    });

    if (fallbackPackages && list.length < MAX_DISPLAY_CONSUMERS) {
      const seenNames = new Set(list.map((c) => c.packageName));
      const userCandidates = fallbackPackages
        .filter(
          (pkg) =>
            pkg.packageType === "user" && !seenNames.has(pkg.name) && (pkg.apkSizeBytes ?? 0) > 0
        )
        .toSorted((a, b) => (b.apkSizeBytes ?? 0) - (a.apkSizeBytes ?? 0));

      for (const fb of userCandidates) {
        if (list.length >= MAX_DISPLAY_CONSUMERS) {
          break;
        }
        const size = fb.apkSizeBytes ?? 24_000_000;
        list.push({
          appSize: size,
          cacheSize: 0,
          dataSize: 0,
          label: fb.label || fb.name,
          packageName: fb.name,
          totalSize: size,
        });
        seenNames.add(fb.name);
      }
    }

    return list.slice(0, MAX_DISPLAY_CONSUMERS);
  }, [consumers, fallbackMap, fallbackPackages]);

  const maxBytes = Math.max(...displayConsumers.map((c) => c.totalSize), 1);

  const fallbackList = useMemo(() => {
    if (displayConsumers.length > 0 || !fallbackPackages) {
      return [];
    }
    return fallbackPackages
      .filter((pkg) => (pkg.apkSizeBytes ?? 0) > 0)
      .toSorted((a, b) => (b.apkSizeBytes ?? 0) - (a.apkSizeBytes ?? 0))
      .slice(0, MAX_DISPLAY_CONSUMERS);
  }, [displayConsumers.length, fallbackPackages]);

  const maxFallbackBytes = Math.max(...fallbackList.map((p) => p.apkSizeBytes ?? 0), 1);

  let headerBadge = null;
  if (displayConsumers.length > 0) {
    headerBadge = (
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
    );
  } else if (fallbackList.length > 0) {
    headerBadge = (
      <span className="text-caption text-muted-foreground bg-surface-raised/80 border-border/40 rounded-full border px-2 py-0.5 font-medium">
        Ranked by APK Size
      </span>
    );
  }

  let content = null;
  if (displayConsumers.length === 0 && fallbackList.length === 0) {
    content = (
      <div className="border-border text-caption text-muted-foreground flex h-32 items-center justify-center rounded-md border border-dashed">
        No storage telemetry available
      </div>
    );
  } else if (displayConsumers.length === 0) {
    content = fallbackList.map((pkg, index) => {
      const label = pkg.label || pkg.name;
      const size = pkg.apkSizeBytes ?? 0;
      return (
        <m.button
          animate={{ opacity: 1, x: 0 }}
          className="group border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised flex flex-1 flex-col justify-center gap-1.5 rounded-md border px-2.5 py-2 text-left transition-colors"
          initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
          key={pkg.name}
          onClick={() => onSelectApp?.(pkg.name)}
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
              <span className="text-caption text-muted-foreground w-4 shrink-0 font-mono">
                #{index + 1}
              </span>
              <span className="text-foreground truncate font-medium">{label}</span>
            </div>
            <span className="numeric text-caption text-muted-foreground font-semibold">
              {formatBytes(size)}
            </span>
          </div>
          <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
            <m.div
              animate={{ scaleX: size / maxFallbackBytes }}
              className="bg-primary h-full w-full origin-left rounded-full"
              initial={shouldReduceMotion ? false : { scaleX: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      delay: 0.15 + index * 0.06,
                      duration: 0.4,
                      ease: EASE_STANDARD,
                    }
              }
            />
          </div>
        </m.button>
      );
    });
  } else {
    content = displayConsumers.map((app, index) => {
      const pkgName = app.packageName;
      const rawLabel = app.label || pkgName;
      const label = rawLabel ? rawLabel.replaceAll(/^["']+|["']+$/gu, "") : pkgName;
      const ratio = (app.totalSize / maxBytes) * 100;
      const appPct = app.totalSize > 0 ? (app.appSize / app.totalSize) * 100 : 40;
      const dataPct = app.totalSize > 0 ? (app.dataSize / app.totalSize) * 100 : 50;
      const cachePct = app.totalSize > 0 ? (app.cacheSize / app.totalSize) * 100 : 10;

      return (
        <m.button
          animate={{ opacity: 1, x: 0 }}
          className="group border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised flex flex-1 flex-col justify-center gap-1.5 rounded-md border px-2.5 py-2 text-left transition-colors"
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
              className="flex h-full w-[var(--bar-width)] overflow-hidden rounded-full"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              style={{ "--bar-width": `${Math.max(4, ratio)}%` } as Record<string, string>}
              transition={
                shouldReduceMotion ? { duration: 0 } : { delay: 0.15 + index * 0.06, duration: 0.4 }
              }
            >
              <div
                className="bg-primary group-hover:bg-primary/90 h-full w-[var(--app-width)] transition-colors"
                style={{ "--app-width": `${appPct}%` } as React.CSSProperties}
                title={`App: ${formatBytes(app.appSize)}`}
              />
              <div
                className="bg-primary/60 group-hover:bg-primary/70 h-full w-[var(--data-width)] transition-colors"
                style={{ "--data-width": `${dataPct}%` } as React.CSSProperties}
                title={`Data: ${formatBytes(app.dataSize)}`}
              />
              <div
                className="bg-primary/30 group-hover:bg-primary/40 h-full w-[var(--cache-width)] transition-colors"
                style={{ "--cache-width": `${cachePct}%` } as React.CSSProperties}
                title={`Cache: ${formatBytes(app.cacheSize)}`}
              />
            </m.div>
          </div>
        </m.button>
      );
    });
  }

  return (
    <div className="border-border bg-surface flex h-full flex-col gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive aria-hidden="true" className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Top Space Consumers</h3>
        </div>
        {headerBadge}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2">{content}</div>
    </div>
  );
};
