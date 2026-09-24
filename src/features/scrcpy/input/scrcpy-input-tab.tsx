import { Keyboard, Sliders } from "lucide-react";

import type { backend } from "@/desktop/models";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/utils/cn";

interface ScrcpyInputTabProps {
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  options: backend.ScrcpyLaunchOptions;
}

export const ScrcpyInputTab = ({ onOptionsChange, options }: ScrcpyInputTabProps) => (
  <div className="flex flex-col gap-4">
    {/* Top Card: Keyboard & Mouse Forwarding */}
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Keyboard aria-hidden="true" className="text-foreground size-4" />
            <CardTitle className="text-body text-foreground font-semibold">
              Input & Hardware Forwarding Engine
            </CardTitle>
          </div>
          <Badge
            className={cn(
              "text-caption",
              options.noControl
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-success/30 bg-success/10 text-success"
            )}
            variant="outline"
          >
            {options.noControl ? "View-Only (No Control)" : "Interactive Control Active"}
          </Badge>
        </div>
        <CardDescription className="text-caption text-muted-foreground">
          Configure physical keyboard simulation protocol, mouse touch injection, and input
          privileges.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
          {/* Keyboard Mode Selector */}
          <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-1.5 rounded-lg border p-3">
            <Label htmlFor="scrcpy-keyboard-mode">Physical Keyboard Mode</Label>
            <Select
              disabled={options.noControl}
              onValueChange={(val) => onOptionsChange({ keyboard: val })}
              value={options.keyboard ?? "uhid"}
            >
              <SelectTrigger className="h-9 w-full" id="scrcpy-keyboard-mode">
                <SelectValue placeholder="UHID (Recommended)" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="uhid">UHID (Hardware USB Keyboard Emulation)</SelectItem>
                  <SelectItem value="sdk">SDK (Android Text Injection)</SelectItem>
                  <SelectItem value="aoa">AOA (Android Open Accessory Mode)</SelectItem>
                  <SelectItem value="disabled">Disabled (No keyboard input)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground pt-1">
              UHID simulates physical USB keyboard scancodes for low-latency shortcuts and games.
            </p>
          </div>

          {/* Read-Only / View-Only Mode Toggle */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="flag-no-control">
                View-Only Mode
              </Label>
              <p className="text-caption text-muted-foreground">
                Mirror display but ignore mouse clicks and keyboard keystrokes
              </p>
            </div>
            <Switch
              checked={options.noControl}
              id="flag-no-control"
              onCheckedChange={(noControl) => onOptionsChange({ noControl })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-3">
          <div className="border-border/60 bg-surface-raised/30 flex flex-col gap-1 rounded-lg border p-2.5">
            <span className="text-caption text-foreground font-semibold">UHID Mode</span>
            <span className="text-caption text-muted-foreground">
              Simulates real USB HID keyboard at OS driver level. Supports gaming WASD, Ctrl, Alt,
              and special keys.
            </span>
          </div>
          <div className="border-border/60 bg-surface-raised/30 flex flex-col gap-1 rounded-lg border p-2.5">
            <span className="text-caption text-foreground font-semibold">SDK Mode</span>
            <span className="text-caption text-muted-foreground">
              Injects software key events through Android framework. Best compatibility on
              older/custom ROMs.
            </span>
          </div>
          <div className="border-border/60 bg-surface-raised/30 flex flex-col gap-1 rounded-lg border p-2.5">
            <span className="text-caption text-foreground font-semibold">AOA Mode</span>
            <span className="text-caption text-muted-foreground">
              Uses USB Accessory protocol for direct hardware HID. Works over USB connections.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Bottom Card: Automation & Lifecycle Toggles */}
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sliders aria-hidden="true" className="text-foreground size-4" />
          <CardTitle className="text-body text-foreground font-semibold">
            Automation & Device Lifecycle Behavior
          </CardTitle>
        </div>
        <CardDescription className="text-caption text-muted-foreground">
          Configure automated device state management during mirroring sessions.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2 @2xl:grid-cols-3">
          {/* Stay Awake */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="input-stay-awake">
                Stay Awake
              </Label>
              <p className="text-caption text-muted-foreground">
                Prevent Android from entering sleep mode while connected
              </p>
            </div>
            <Switch
              checked={options.stayAwake}
              id="input-stay-awake"
              onCheckedChange={(stayAwake) => onOptionsChange({ stayAwake })}
            />
          </div>

          {/* Turn Screen Off */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label
                className="text-body text-foreground font-medium"
                htmlFor="input-turn-screen-off"
              >
                Turn Screen Off on Start
              </Label>
              <p className="text-caption text-muted-foreground">
                Power down physical phone OLED/LCD to save battery
              </p>
            </div>
            <Switch
              checked={options.turnScreenOff}
              id="input-turn-screen-off"
              onCheckedChange={(turnScreenOff) => onOptionsChange({ turnScreenOff })}
            />
          </div>

          {/* Show Touches */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="input-show-touches">
                Show Touch Dots
              </Label>
              <p className="text-caption text-muted-foreground">
                Show visual circular touch point indicator on clicks
              </p>
            </div>
            <Switch
              checked={options.showTouches}
              id="input-show-touches"
              onCheckedChange={(showTouches) => onOptionsChange({ showTouches })}
            />
          </div>

          {/* Fullscreen */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="input-fullscreen">
                Start Fullscreen
              </Label>
              <p className="text-caption text-muted-foreground">
                Expand mirror window to take up entire PC monitor
              </p>
            </div>
            <Switch
              checked={options.fullscreen}
              id="input-fullscreen"
              onCheckedChange={(fullscreen) => onOptionsChange({ fullscreen })}
            />
          </div>

          {/* Always on Top */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label
                className="text-body text-foreground font-medium"
                htmlFor="input-always-on-top"
              >
                Always on Top
              </Label>
              <p className="text-caption text-muted-foreground">
                Pin mirror window above IDE, browser, and all other apps
              </p>
            </div>
            <Switch
              checked={options.alwaysOnTop}
              id="input-always-on-top"
              onCheckedChange={(alwaysOnTop) => onOptionsChange({ alwaysOnTop })}
            />
          </div>

          {/* Borderless */}
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="input-borderless">
                Borderless Window
              </Label>
              <p className="text-caption text-muted-foreground">
                Remove titlebar and standard OS window chrome
              </p>
            </div>
            <Switch
              checked={options.borderless}
              id="input-borderless"
              onCheckedChange={(borderless) => onOptionsChange({ borderless })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
