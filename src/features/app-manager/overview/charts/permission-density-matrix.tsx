import { m, useReducedMotion } from "framer-motion";
import { Camera, Eye, HardDrive, MapPin, Mic, Phone, Shield } from "lucide-react";

import type { backend } from "@/desktop/models";
import { cn } from "@/shared/utils/cn";

interface PermissionDensityMatrixProps {
  items?: backend.PermissionDensityItem[];
  userAppCount?: number;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];
const DEFAULT_ITEMS: backend.PermissionDensityItem[] = [];

const getPermissionIcon = (permission?: string | null, label?: string | null) => {
  const text = `${permission ?? ""} ${label ?? ""}`.toLowerCase();
  if (text.includes("camera")) {
    return Camera;
  }
  if (text.includes("audio") || text.includes("record") || text.includes("mic")) {
    return Mic;
  }
  if (text.includes("location") || text.includes("gps")) {
    return MapPin;
  }
  if (
    text.includes("phone") ||
    text.includes("call") ||
    text.includes("sms") ||
    text.includes("contact")
  ) {
    return Phone;
  }
  if (text.includes("storage") || text.includes("media") || text.includes("files")) {
    return HardDrive;
  }
  return Shield;
};

const getRiskLabel = (risk?: string | null) => {
  if (!risk) {
    return {
      label: "Standard",
      meterClass: "bg-muted-foreground/50",
      toneClass: "text-muted-foreground",
    };
  }
  switch (risk.toLowerCase()) {
    case "critical": {
      return {
        label: "Critical",
        meterClass: "bg-destructive",
        toneClass: "text-destructive",
      };
    }
    case "elevated":
    case "high": {
      return {
        label: "High",
        meterClass: "bg-warning",
        toneClass: "text-warning",
      };
    }
    default: {
      return {
        label: "Standard",
        meterClass: "bg-muted-foreground/50",
        toneClass: "text-muted-foreground",
      };
    }
  }
};

export const PermissionDensityMatrix = ({
  items = DEFAULT_ITEMS,
  userAppCount,
}: PermissionDensityMatrixProps) => {
  const shouldReduceMotion = useReducedMotion();
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="border-border bg-surface flex h-full flex-col justify-between gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye aria-hidden="true" className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Permission & Privacy Footprint</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground">
          {userAppCount ? `across ${userAppCount} user apps` : "User App Exposure"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="border-border text-caption text-muted-foreground flex h-28 items-center justify-center rounded-md border border-dashed">
          No permission telemetry available
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, index) => {
            const Icon = getPermissionIcon(item.permission, item.label);
            const isExposed = item.count > 0;
            const riskInfo = isExposed
              ? getRiskLabel(item.riskLevel ?? item.risk)
              : {
                  label: "None exposed",
                  meterClass: "bg-muted-foreground/20",
                  toneClass: "text-muted-foreground/70",
                };
            return (
              <m.div
                animate={{ opacity: 1, y: 0 }}
                className="border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised flex flex-col gap-1.5 rounded-md border p-2 transition-colors"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                key={item.permission || item.label}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        delay: 0.1 + index * 0.05,
                        duration: 0.28,
                        ease: EASE_STANDARD,
                      }
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        isExposed ? "text-primary" : "text-muted-foreground/50"
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-body text-foreground truncate font-medium">
                        {item.label || item.permission}
                      </span>
                      <span className={cn("text-caption", riskInfo.toneClass)}>
                        {riskInfo.label}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "numeric text-body shrink-0",
                      isExposed
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground font-medium"
                    )}
                  >
                    {item.count}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="bg-secondary h-1 w-full overflow-hidden rounded-full"
                >
                  <m.div
                    animate={{ scaleX: item.count / maxCount }}
                    className={cn("h-full w-full origin-left", riskInfo.meterClass)}
                    initial={shouldReduceMotion ? false : { scaleX: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            delay: 0.15 + index * 0.05,
                            duration: 0.4,
                            ease: EASE_STANDARD,
                          }
                    }
                  />
                </div>
              </m.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
