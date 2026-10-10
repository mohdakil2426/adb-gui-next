import { m, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BatteryCharging,
  Camera,
  Code2,
  Folder,
  LayoutGrid,
  Play,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import { RunShellCommand } from "@/desktop/backend";

const LAUNCHPAD_ACTIONS = [
  {
    cmd: "am start -a android.settings.SETTINGS",
    icon: Settings,
    label: "Android Settings",
  },
  {
    cmd: "am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS",
    icon: Code2,
    label: "Developer Options",
  },
  {
    cmd: "am start -a android.intent.action.VIEW -d content://media/internal/images/media",
    icon: Folder,
    label: "Files & Media",
  },
  {
    cmd: "am start -a android.settings.MANAGE_ALL_APPLICATIONS_SETTINGS",
    icon: LayoutGrid,
    label: "Manage All Apps",
  },
  {
    cmd: "am start -a android.intent.action.POWER_USAGE_SUMMARY",
    icon: BatteryCharging,
    label: "Battery & Power",
  },
  {
    cmd: "am start -a android.media.action.IMAGE_CAPTURE",
    icon: Camera,
    label: "Camera",
  },
] as const;

interface QuickLaunchpadCardProps {
  selectedSerial: string | null;
}

export const QuickLaunchpadCard = ({ selectedSerial }: QuickLaunchpadCardProps) => {
  const shouldReduceMotion = useReducedMotion();
  const launchIntent = async (label: string, intentCmd: string) => {
    if (!selectedSerial) {
      toast.error("No device connected");
      return;
    }
    try {
      await RunShellCommand(intentCmd, selectedSerial);
      toast.success(`Launched ${label} on device`);
    } catch (error) {
      toast.error(`Failed to launch ${label}: ${String(error)}`);
    }
  };

  return (
    <div className="border-border bg-surface flex h-full flex-col justify-between gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Device App Launchpad</h3>
        </div>
        <span className="text-caption text-muted-foreground">Direct ADB Intents</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {LAUNCHPAD_ACTIONS.map((act, index) => {
          const Icon = act.icon;
          return (
            <m.button
              animate={{ opacity: 1, y: 0 }}
              className="group border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised flex h-8.5 w-full items-center justify-between rounded-md border px-2.5 text-left transition-all active:scale-[0.99]"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              key={act.label}
              onClick={() => launchIntent(act.label, act.cmd)}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      delay: index * 0.04,
                      duration: 0.28,
                      ease: [0.2, 0, 0, 1],
                    }
              }
              type="button"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon aria-hidden="true" className="text-primary size-3.5 shrink-0" />
                <span className="text-caption text-foreground truncate font-medium">
                  {act.label}
                </span>
              </div>
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted-foreground/30 group-hover:text-primary size-3 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </m.button>
          );
        })}
      </div>
    </div>
  );
};
