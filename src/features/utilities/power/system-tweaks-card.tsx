/* eslint-disable react/todo -- non-React-Compiler try/finally flow */
import { Loader2, Moon, RotateCcw, Sliders, Sun } from "lucide-react";
import { useState } from "react";

import { RunShellCommand } from "@/desktop/backend";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { handleError, handleSuccess } from "@/shared/utils/error-handler";

interface SystemTweaksCardProps {
  deviceMode: "adb" | "fastboot" | "unknown";
  deviceSerial: string | null;
}

export const SystemTweaksCard = ({ deviceMode, deviceSerial }: SystemTweaksCardProps) => {
  const isAdb = deviceMode === "adb" && Boolean(deviceSerial);
  const [animScale, setAnimScale] = useState<string>("1.0");
  const [customDpi, setCustomDpi] = useState<string>("");
  const [isTweaking, setIsTweaking] = useState<string | null>(null);

  const handleSoftReboot = async () => {
    if (!deviceSerial) {
      return;
    }
    setIsTweaking("soft-reboot");
    try {
      await RunShellCommand("setprop ctl.restart zygote", deviceSerial);
      handleSuccess("Soft Reboot", "Soft reboot triggered (Zygote framework restart)");
    } catch (error) {
      handleError("Soft Reboot", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTweaking(null);
    }
  };

  const handleSetAnimationScale = async (scale: string) => {
    if (!deviceSerial) {
      return;
    }
    setIsTweaking(`anim-${scale}`);
    try {
      await Promise.all([
        RunShellCommand(`settings put global window_animation_scale ${scale}`, deviceSerial),
        RunShellCommand(`settings put global transition_animation_scale ${scale}`, deviceSerial),
        RunShellCommand(`settings put global animator_duration_scale ${scale}`, deviceSerial),
      ]);
      setAnimScale(scale);
      handleSuccess("Animation Scale", `System animation scale set to ${scale}x`);
    } catch (error) {
      handleError("Animation Scale", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTweaking(null);
    }
  };

  const handleSetDarkTheme = async (enable: boolean) => {
    if (!deviceSerial) {
      return;
    }
    setIsTweaking("dark-theme");
    try {
      await RunShellCommand(`cmd uimode night ${enable ? "yes" : "no"}`, deviceSerial);
      handleSuccess("Dark Theme", `Force dark theme ${enable ? "enabled" : "disabled"}`);
    } catch (error) {
      handleError("Dark Theme", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTweaking(null);
    }
  };

  const handleSetDpi = async () => {
    if (!(deviceSerial && customDpi)) {
      return;
    }
    setIsTweaking("dpi");
    try {
      await RunShellCommand(`wm density ${customDpi}`, deviceSerial);
      handleSuccess("Display Density", `Screen density set to ${customDpi} DPI`);
    } catch (error) {
      handleError("Display Density", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTweaking(null);
    }
  };

  const handleResetDpi = async () => {
    if (!deviceSerial) {
      return;
    }
    setIsTweaking("dpi-reset");
    try {
      await RunShellCommand("wm density reset", deviceSerial);
      setCustomDpi("");
      handleSuccess("Display Density", "Display density reset to hardware default");
    } catch (error) {
      handleError("Display Density", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTweaking(null);
    }
  };

  return (
    <Card className="border-border bg-surface rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-title flex items-center gap-2 font-semibold">
          <Sliders className="text-primary size-4.5" />
          Android System Tweaks
        </CardTitle>
        <CardDescription className="text-body text-muted-foreground">
          Runtime UI modifications, framework zygote restarts, and window scaling parameters
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        <div className="grid gap-4 @xs:grid-cols-1 @lg:grid-cols-2">
          {/* Tweak 1: Animation Scale */}
          <div className="border-border/80 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-foreground font-semibold">
                Window Animation Scales
              </span>
              <span className="text-caption text-muted-foreground">
                Speed up transitions or disable animations completely
              </span>
            </div>

            <div className="flex items-center gap-2">
              {["0.0", "0.5", "1.0", "1.5"].map((scale) => (
                <Button
                  className="text-caption h-8 flex-1"
                  disabled={!isAdb || Boolean(isTweaking)}
                  key={scale}
                  onClick={() => {
                    void handleSetAnimationScale(scale);
                  }}
                  size="sm"
                  type="button"
                  variant={animScale === scale ? "default" : "outline"}
                >
                  {scale === "0.0" ? "Off" : `${scale}x`}
                </Button>
              ))}
            </div>
          </div>

          {/* Tweak 2: Force Dark Mode */}
          <div className="border-border/80 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-foreground font-semibold">
                System Dark / Light Mode
              </span>
              <span className="text-caption text-muted-foreground">
                Directly force Android system night mode state
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="text-caption h-8 flex-1 gap-1.5"
                disabled={!isAdb || Boolean(isTweaking)}
                onClick={() => {
                  void handleSetDarkTheme(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Moon className="text-muted-foreground size-3.5" data-icon="inline-start" />
                Force Dark
              </Button>
              <Button
                className="text-caption h-8 flex-1 gap-1.5"
                disabled={!isAdb || Boolean(isTweaking)}
                onClick={() => {
                  void handleSetDarkTheme(false);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sun className="text-muted-foreground size-3.5" data-icon="inline-start" />
                Force Light
              </Button>
            </div>
          </div>

          {/* Tweak 3: Display Density */}
          <div className="border-border/80 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-foreground font-semibold">
                Custom Display Density
              </span>
              <span className="text-caption text-muted-foreground">
                Override screen DPI (e.g. 420, 480, 560)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                aria-label="Custom display density DPI"
                className="text-body h-8"
                disabled={!isAdb}
                onChange={(e) => setCustomDpi(e.target.value)}
                placeholder="DPI (e.g. 420)"
                value={customDpi}
              />
              <Button
                className="text-caption h-8 shrink-0"
                disabled={!(isAdb && customDpi) || Boolean(isTweaking)}
                onClick={() => {
                  void handleSetDpi();
                }}
                size="sm"
                type="button"
              >
                Apply
              </Button>
              <Button
                className="text-caption h-8 shrink-0"
                disabled={!isAdb || Boolean(isTweaking)}
                onClick={() => {
                  void handleResetDpi();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Tweak 4: Soft Reboot */}
          <div className="border-border/80 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-foreground font-semibold">Zygote Soft Reboot</span>
              <span className="text-caption text-muted-foreground">
                Restarts the Android framework without kernel reboot
              </span>
            </div>

            <Button
              className="text-caption h-8 gap-1.5"
              disabled={!isAdb || Boolean(isTweaking)}
              onClick={() => {
                void handleSoftReboot();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {isTweaking === "soft-reboot" ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <RotateCcw className="text-muted-foreground size-3.5" data-icon="inline-start" />
              )}
              Trigger Soft Reboot
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
