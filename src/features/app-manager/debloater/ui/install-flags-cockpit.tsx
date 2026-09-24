import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  RotateCcw,
  Sliders,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { INSTALL_FLAGS_CATALOG } from "@/features/app-manager/debloater/model/install-flags";
import {
  buildAdbInstallFlags,
  DEFAULT_INSTALL_FLAGS,
  useInstallationStore,
} from "@/features/app-manager/debloater/model/installation-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/utils/cn";

interface InstallFlagsCockpitProps {
  disabled?: boolean;
}

/**
 * Precision Hardware Cockpit switchboard for ADB installation flags.
 * Gives developers full control over `-r`, `-d`, `-g`, `-t`, and low-SDK bypass flags.
 */
export const InstallFlagsCockpit = ({ disabled = false }: InstallFlagsCockpitProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const installFlags = useInstallationStore((s) => s.installFlags);
  const setInstallFlags = useInstallationStore((s) => s.setInstallFlags);
  const resetInstallFlags = useInstallationStore((s) => s.resetInstallFlags);

  const activeFlagArgs = useMemo(() => buildAdbInstallFlags(installFlags), [installFlags]);

  const isCustomized = useMemo(
    () =>
      installFlags.reinstall !== DEFAULT_INSTALL_FLAGS.reinstall ||
      installFlags.allowDowngrade !== DEFAULT_INSTALL_FLAGS.allowDowngrade ||
      installFlags.grantPermissions !== DEFAULT_INSTALL_FLAGS.grantPermissions ||
      installFlags.allowTestPackages !== DEFAULT_INSTALL_FLAGS.allowTestPackages ||
      installFlags.bypassLowTargetSdk !== DEFAULT_INSTALL_FLAGS.bypassLowTargetSdk ||
      installFlags.userId !== DEFAULT_INSTALL_FLAGS.userId,
    [installFlags]
  );

  const applyPreset = (preset: "default" | "developer" | "legacy") => {
    if (preset === "default") {
      resetInstallFlags();
    } else if (preset === "developer") {
      setInstallFlags({
        allowDowngrade: true,
        allowTestPackages: true,
        bypassLowTargetSdk: false,
        grantPermissions: true,
        reinstall: true,
      });
    } else if (preset === "legacy") {
      setInstallFlags({
        allowDowngrade: true,
        allowTestPackages: false,
        bypassLowTargetSdk: true,
        grantPermissions: false,
        reinstall: true,
      });
    }
  };

  return (
    <div className="border-border bg-surface flex flex-col rounded-lg border shadow-none">
      {/* Header Banner & Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="border-border bg-surface-raised text-muted-foreground flex size-7 items-center justify-center rounded-md border">
            <Sliders aria-hidden="true" className="size-3.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-body text-foreground font-semibold">
                ADB Install Flags Cockpit
              </span>
              {isCustomized ? (
                <Badge className="text-caption h-4.5 px-1.5" variant="secondary">
                  Customized
                </Badge>
              ) : null}
            </div>
            <span className="text-caption text-muted-foreground">
              Configure parameters sent to{" "}
              <code className="text-foreground/80 font-mono">adb install</code>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Active Flags Command Preview Pill */}
          <div className="border-border-control bg-surface-raised text-foreground text-mono-sm hidden items-center gap-1 rounded-md border px-2 py-1 font-mono @lg:flex">
            <Terminal aria-hidden="true" className="text-muted-foreground size-3" />
            <span>adb install {activeFlagArgs.join(" ") || "(none)"}</span>
          </div>

          {isCustomized ? (
            <Button
              className="text-caption text-muted-foreground hover:text-foreground h-7 px-2"
              disabled={disabled}
              onClick={resetInstallFlags}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-3" data-icon="inline-start" />
              Reset
            </Button>
          ) : null}

          <Button
            className="text-caption h-7 gap-1 px-2.5 font-medium"
            onClick={() => setIsExpanded((v) => !v)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isExpanded ? (
              <>
                <ChevronUp aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                Hide Controls
              </>
            ) : (
              <>
                <ChevronDown aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                Configure ({activeFlagArgs.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Precision Toggle Switchboard */}
      {isExpanded ? (
        <div className="border-border bg-surface-raised/40 flex flex-col gap-3 border-t p-3.5">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-muted-foreground font-medium tracking-wider uppercase">
              Quick Setup Presets
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                className="text-caption h-6.5 px-2"
                disabled={disabled}
                onClick={() => applyPreset("default")}
                size="sm"
                type="button"
                variant="outline"
              >
                Standard (-r)
              </Button>
              <Button
                className="text-caption h-6.5 px-2"
                disabled={disabled}
                onClick={() => applyPreset("developer")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Cpu aria-hidden="true" className="size-3" data-icon="inline-start" />
                Dev Mode (-r -g -t -d)
              </Button>
              <Button
                className="text-caption h-6.5 px-2"
                disabled={disabled}
                onClick={() => applyPreset("legacy")}
                size="sm"
                type="button"
                variant="outline"
              >
                Legacy / Android 14+ Bypass
              </Button>
            </div>
          </div>

          {/* Grid of Switchboard Tiles */}
          <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
            {INSTALL_FLAGS_CATALOG.map((item) => {
              const isChecked = Boolean(installFlags[item.id]);

              return (
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors",
                    isChecked
                      ? "border-foreground/20 bg-surface shadow-xs"
                      : "border-border/70 bg-surface/50 opacity-80 hover:opacity-100"
                  )}
                  key={item.id}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-foreground text-mono font-mono font-bold">
                        {item.flag}
                      </span>
                      <span className="text-body text-foreground font-medium">{item.label}</span>
                      {item.badge ? (
                        <Badge
                          className="text-caption h-4 px-1"
                          variant={item.badgeTone === "warning" ? "outline" : "secondary"}
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-caption text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>

                    {item.riskNotice && isChecked ? (
                      <div className="border-warning/20 bg-warning/10 text-caption text-warning mt-1 flex items-start gap-1.5 rounded-md border px-2 py-1">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                        <span>{item.riskNotice}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-0.5">
                    <Switch
                      aria-label={`Toggle flag ${item.flag}`}
                      checked={isChecked}
                      disabled={disabled}
                      id={`flag-${item.id}`}
                      onCheckedChange={(checked) => {
                        setInstallFlags({ [item.id]: checked });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* User ID specification note */}
          <div className="border-border bg-surface text-caption text-muted-foreground flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Info aria-hidden="true" className="text-muted-foreground size-3.5" />
              <span>
                Targets current active user profile (
                <code className="text-foreground font-mono">--user 0</code> by default).
              </span>
            </div>
            <div className="text-foreground text-mono-sm flex items-center gap-1 font-mono">
              <span>Selected flags:</span>
              <span className="bg-muted text-primary rounded px-1.5 py-0.5 font-bold">
                {activeFlagArgs.join(" ") || "none"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
